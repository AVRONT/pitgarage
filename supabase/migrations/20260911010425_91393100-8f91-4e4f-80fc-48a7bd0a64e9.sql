-- Prepared locally only. Costs leave operational JSON so table SELECT cannot bypass permission.
begin;
create table public.financial_permissions (
  user_id uuid primary key references public.user_profiles(user_id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.financial_permissions enable row level security;
revoke all on public.financial_permissions from public, anon, authenticated;

create function public.can_view_financial() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(pitgarage_private.current_access_level() = 'owner' or (
    pitgarage_private.current_access_level() in ('admin','staff') and exists (
      select 1 from public.financial_permissions where user_id = auth.uid()
    )), false);
$$;
revoke all on function public.can_view_financial() from public, anon;
grant execute on function public.can_view_financial() to authenticated;

create table public.order_part_financials (
  order_id uuid not null references public.service_orders(id),
  item_id text not null,
  unit_cost numeric,
  markup numeric,
  updated_at timestamptz not null default now(),
  primary key (order_id,item_id),
  check (unit_cost is null or (unit_cost >= 0 and unit_cost <= 100000000)),
  check (markup is null or (markup >= 0 and markup <= 100000))
);
alter table public.order_part_financials enable row level security;
revoke all on public.order_part_financials from public, anon, authenticated;
grant select on public.order_part_financials to authenticated;
create policy financial_read on public.order_part_financials for select to authenticated
  using ((select public.can_view_financial()));
-- Retain exact legacy source privately, including unusual data, before migration.
create table pitgarage_private.legacy_financial_budgets as
  select id as order_id, budget, now() as archived_at from public.service_orders
  where exists (select 1 from jsonb_array_elements(budget) b where b ? 'cost' or b ? 'markup');
revoke all on pitgarage_private.legacy_financial_budgets from public, anon, authenticated;
do $$ begin
  if exists (
    select 1 from public.service_orders s, jsonb_array_elements(s.budget) b
    where b->>'type' = 'Peça' group by s.id,b->>'id' having count(*) > 1
  ) then raise exception 'Duplicate part identifiers: review before financial migration'; end if;
end $$;
insert into public.order_part_financials(order_id,item_id,unit_cost,markup)
select s.id,b->>'id',
  case when jsonb_typeof(b->'cost')='number' and (b->>'cost')::numeric between 0 and 100000000 then (b->>'cost')::numeric end,
  case when jsonb_typeof(b->'markup')='number' and (b->>'markup')::numeric between 0 and 100000 then (b->>'markup')::numeric end
from public.service_orders s, jsonb_array_elements(s.budget) b
where b->>'type'='Peça' and b->>'id' is not null and (b ? 'cost' or b ? 'markup');
update public.service_orders s set budget=(
  select coalesce(jsonb_agg(b - 'cost' - 'markup' order by n),'[]'::jsonb)
  from jsonb_array_elements(s.budget) with ordinality as e(b,n)
), updated_at=clock_timestamp()
where exists (select 1 from jsonb_array_elements(s.budget) b where b ? 'cost' or b ? 'markup');

create function pitgarage_private.reject_exposed_costs() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists(select 1 from jsonb_array_elements(new.budget) b where b ? 'cost' or b ? 'markup')
  then raise exception using errcode='42501', message='Costs must use the financial API'; end if;
  return new;
end $$;
create trigger reject_exposed_costs before insert or update of budget on public.service_orders
  for each row execute function pitgarage_private.reject_exposed_costs();

create function public.list_financial_members() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if pitgarage_private.current_access_level() is distinct from 'owner' then
    raise exception using errcode='42501', message='Owner access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'full_name',p.full_name,
    'owner',p.access_level='owner','allowed',p.access_level='owner' or f.user_id is not null) order by p.full_name),'[]'::jsonb)
    from public.user_profiles p left join public.financial_permissions f using(user_id)
    where p.is_active and p.access_level in ('owner','admin','staff'));
end $$;
create function public.set_financial_permission(target_user uuid, allowed boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.user_profiles;
begin
  if pitgarage_private.current_access_level() is distinct from 'owner' then
    raise exception using errcode='42501', message='Owner access required'; end if;
  select * into target from public.user_profiles where user_id=target_user for update;
  if not found or not target.is_active or target.access_level not in ('admin','staff') then
    raise exception 'Only active admin/staff permissions may be changed'; end if;
  if allowed then insert into public.financial_permissions(user_id) values(target_user) on conflict do nothing;
  else delete from public.financial_permissions where user_id=target_user; end if;
end $$;
create function public.get_part_financial(order_id uuid,item_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
  return coalesce((select jsonb_build_object('unitCost',f.unit_cost,'markup',f.markup)
    from public.order_part_financials f where f.order_id=$1 and f.item_id=$2),
    jsonb_build_object('unitCost',null,'markup',null));
end $$;
create function public.save_part_financial(order_id uuid, expected_version timestamptz,
  item_id text, unit_cost numeric, markup numeric, quantity integer, unit_price numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.service_orders; part jsonb; replacement jsonb; next_budget jsonb; sale_changed boolean;
begin
  if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
  if quantity is null or quantity not between 1 and 100000 or unit_price is null or unit_price not between 0 and 100000000
    or (unit_cost is not null and unit_cost not between 0 and 100000000)
    or (markup is not null and markup not between 0 and 100000) then raise exception 'Invalid part values'; end if;
  select * into target from public.service_orders where id=$1 for update;
  if not found then raise exception 'Order not found'; end if;
  if target.updated_at is distinct from expected_version then raise exception using errcode='40001',message='Order version conflict'; end if;
  if (select count(*) from jsonb_array_elements(target.budget) b where b->>'id'=item_id and b->>'type'='Peça') <> 1 then
    raise exception 'Part not found or duplicated'; end if;
  select b into part from jsonb_array_elements(target.budget) b where b->>'id'=item_id;
  sale_changed := quantity::numeric is distinct from coalesce((part->>'quantity')::numeric,1)
    or unit_price is distinct from coalesce((part->>'unitPrice')::numeric,
      (part->>'price')::numeric / coalesce((part->>'quantity')::numeric,1));
  -- Costs can be completed later; changing an approved/executed sale requires the existing reapproval workflow.
  if (part->>'approval' is distinct from 'Aguardando aprovação' or part->>'executed'='true'
      or target.status in ('Serviço concluído','Aguardando retirada','Entregue'))
    and sale_changed
  then raise exception 'Reopen approval through the existing workflow before changing quantity or sale price'; end if;
  replacement := case when sale_changed then part || jsonb_build_object('quantity',quantity,'unitPrice',unit_price,'price',round(unit_price*quantity,2)) else part end;
  select jsonb_agg(case when b->>'id'=item_id then replacement else b end order by n) into next_budget
    from jsonb_array_elements(target.budget) with ordinality e(b,n);
  insert into public.order_part_financials(order_id,item_id,unit_cost,markup)
    values($1,$3,$4,$5) on conflict on constraint order_part_financials_pkey
    do update set unit_cost=excluded.unit_cost,markup=excluded.markup,updated_at=clock_timestamp();
  update public.service_orders set budget=next_budget,
    activities=activities || jsonb_build_array(jsonb_build_object('id','a-'||gen_random_uuid(),'type','budget',
      'description','Dados da peça atualizados','at',clock_timestamp())),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond')
    where id=$1 returning * into target;
  return to_jsonb(target);
end $$;
create function public.financial_report() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'orderId',s.id,'kind',v.kind,'completedAt',s.completed_at,
    'quantity',coalesce((b->>'quantity')::numeric,1),'revenue',(b->>'price')::numeric,'unitCost',f.unit_cost
  )),'[]'::jsonb) from public.service_orders s join public.vehicles v on v.id=s.vehicle_id
  cross join lateral jsonb_array_elements(s.budget) b
  left join public.order_part_financials f on f.order_id=s.id and f.item_id=b->>'id'
  where s.status in ('Serviço concluído','Aguardando retirada','Entregue')
    and b->>'type'='Peça' and b->>'approval'='Aprovado' and b->>'executed'='true');
end $$;
revoke all on function public.list_financial_members(),public.set_financial_permission(uuid,boolean),
 public.get_part_financial(uuid,text),public.save_part_financial(uuid,timestamptz,text,numeric,numeric,integer,numeric),
 public.financial_report() from public,anon;
grant execute on function public.list_financial_members(),public.set_financial_permission(uuid,boolean),
 public.get_part_financial(uuid,text),public.save_part_financial(uuid,timestamptz,text,numeric,numeric,integer,numeric),
 public.financial_report() to authenticated;
commit;