create table public.revenue_categories (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid references public.revenue_categories(id),
 name text not null check(length(btrim(name)) between 1 and 100),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 check(id is distinct from parent_id)
);
create index revenue_categories_parent on public.revenue_categories(parent_id);
create table public.extra_revenues (
 id uuid primary key,
 date date not null,
 category_id uuid not null references public.revenue_categories(id),
 subcategory_id uuid references public.revenue_categories(id),
 description text not null check(length(btrim(description)) between 1 and 500),
 revenue numeric(14,2) not null check(revenue between 0.01 and 100000000),
 cost numeric(14,2) not null default 0 check(cost between 0 and 100000000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index extra_revenues_date on public.extra_revenues(date);
create index extra_revenues_category on public.extra_revenues(category_id,subcategory_id);
alter table public.revenue_categories enable row level security;
alter table public.extra_revenues enable row level security;
revoke all on public.revenue_categories,public.extra_revenues from public,anon,authenticated;
grant select on public.revenue_categories,public.extra_revenues to authenticated;
create policy financial_category_read on public.revenue_categories for select to authenticated using ((select public.can_view_financial()));
create policy financial_extra_read on public.extra_revenues for select to authenticated using ((select public.can_view_financial()));

create function pitgarage_private.require_revenue_write() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_view_financial() or coalesce(pitgarage_private.current_access_level() not in ('owner','admin'),true) then
 raise exception using errcode='42501',message='Owner/admin financial access required'; end if;
end $$;
revoke all on function pitgarage_private.require_revenue_write() from public,anon,authenticated;

create function public.save_revenue_category(category_id uuid, category_name text, parent uuid, enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.revenue_categories;
begin
 perform pitgarage_private.require_revenue_write();
 if enabled is null or category_id is null or coalesce(length(btrim(category_name)),0) not between 1 and 100 then raise exception 'Invalid category'; end if;
 if parent is not null and not exists(select 1 from public.revenue_categories c where c.id=parent and c.parent_id is null and c.active for share) then raise exception 'Active parent category required'; end if;
 select * into result from public.revenue_categories where id=category_id for update;
 if found then
   if result.parent_id is distinct from parent then raise exception 'Category parent cannot be changed'; end if;
   update public.revenue_categories set name=btrim(category_name),active=enabled where id=category_id returning * into result;
 else
   insert into public.revenue_categories(id,name,parent_id,active) values(category_id,btrim(category_name),parent,enabled) returning * into result;
 end if;
 return to_jsonb(result);
end $$;
revoke all on function public.save_revenue_category(uuid,text,uuid,boolean) from public,anon;
grant execute on function public.save_revenue_category(uuid,text,uuid,boolean) to authenticated;

create function public.add_extra_revenue(entry jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.extra_revenues; entry_id uuid; cat uuid; sub uuid; revenue numeric; cost numeric; day date;
begin
 perform pitgarage_private.require_revenue_write();
 entry_id := (entry->>'id')::uuid; cat := (entry->>'categoryId')::uuid; sub := nullif(entry->>'subcategoryId','')::uuid;
 revenue := (entry->>'revenue')::numeric; cost := coalesce((entry->>'cost')::numeric,0); day := (entry->>'date')::date;
 if entry_id is null or day is null or not isfinite(day) or revenue is null or revenue not between 0.01 and 100000000 or cost not between 0 and 100000000
 or revenue<>round(revenue,2) or cost<>round(cost,2) or coalesce(length(btrim(entry->>'description')),0) not between 1 and 500 then raise exception 'Invalid revenue'; end if;
 if not exists(select 1 from public.revenue_categories c where c.id=cat and c.parent_id is null and c.active for share) then raise exception 'Active category required'; end if;
 if sub is not null and not exists(select 1 from public.revenue_categories c where c.id=sub and c.parent_id=cat and c.active for share) then raise exception 'Subcategory does not belong to category'; end if;
 insert into public.extra_revenues(id,date,category_id,subcategory_id,description,revenue,cost,created_by)
 values(entry_id,day,cat,sub,btrim(entry->>'description'),revenue,cost,auth.uid()) on conflict(id) do nothing;
 select * into result from public.extra_revenues where id=entry_id;
 if result.date<>day or result.category_id<>cat or result.subcategory_id is distinct from sub or result.description<>btrim(entry->>'description')
 or result.revenue<>revenue or result.cost<>cost or result.created_by<>auth.uid() then raise exception 'Entry id already used'; end if;
 return to_jsonb(result);
end $$;
revoke all on function public.add_extra_revenue(jsonb) from public,anon;
grant execute on function public.add_extra_revenue(jsonb) to authenticated;
create function public.list_extra_revenues() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
 return jsonb_build_object('categories',coalesce((select jsonb_agg(c order by c.name) from public.revenue_categories c),'[]'::jsonb),
 'entries',coalesce((select jsonb_agg(e order by e.date desc,e.created_at desc) from public.extra_revenues e),'[]'::jsonb));
end $$;
revoke all on function public.list_extra_revenues() from public,anon;
grant execute on function public.list_extra_revenues() to authenticated;