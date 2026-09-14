create sequence if not exists public.quote_number_seq;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number bigint not null default nextval('public.quote_number_seq'),
  customer_id uuid not null references public.customers(id),
  vehicle_id uuid references public.vehicles(id),
  description text not null default '',
  notes text not null default '',
  status text not null default 'Rascunho'
    check (status in ('Rascunho','Enviado','Aprovado','Recusado','Expirado','Convertido')),
  items jsonb not null default '[]'::jsonb,
  warranty_days integer not null default 90,
  service_order_id uuid references public.service_orders(id),
  converted_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index quotes_number_key on public.quotes(quote_number);
create index quotes_customer_idx on public.quotes(customer_id);

grant select, insert, update, delete on public.quotes to authenticated;
grant all on public.quotes to service_role;
alter table public.quotes enable row level security;
create policy quotes_team_all on public.quotes for all to authenticated
  using ((select pitgarage_private.is_team_member()))
  with check ((select pitgarage_private.is_team_member()));

create table public.quote_item_financials (
  quote_id uuid not null references public.quotes(id) on delete cascade,
  item_id text not null,
  unit_cost numeric,
  markup numeric,
  updated_at timestamptz not null default now(),
  primary key (quote_id, item_id)
);
grant select on public.quote_item_financials to authenticated;
grant all on public.quote_item_financials to service_role;
alter table public.quote_item_financials enable row level security;
create policy quote_financial_read on public.quote_item_financials for select to authenticated
  using ((select public.can_view_financial()));

create or replace function pitgarage_private.require_quote_access()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin','staff'), true) then
    raise exception using errcode='42501', message='Workshop access required';
  end if;
end $$;
revoke all on function pitgarage_private.require_quote_access() from public, anon, authenticated;

create or replace function public.create_quote(
  customer uuid, vehicle uuid, quote_description text, quote_notes text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare created public.quotes;
begin
  perform pitgarage_private.require_quote_access();
  if vehicle is not null and not exists (
    select 1 from public.vehicles v where v.id = vehicle and v.customer_id = customer and v.deleted_at is null
  ) then raise exception 'Vehicle does not belong to this customer'; end if;
  insert into public.quotes(customer_id, vehicle_id, description, notes, created_by)
  values (customer, vehicle, coalesce(quote_description,''), coalesce(quote_notes,''), auth.uid())
  returning * into created;
  return to_jsonb(created);
end $$;
revoke all on function public.create_quote(uuid,uuid,text,text) from public, anon;
grant execute on function public.create_quote(uuid,uuid,text,text) to authenticated;

create or replace function public.update_quote(
  quote_id uuid, expected_version timestamptz, quote_description text, quote_notes text, vehicle uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.quotes;
begin
  perform pitgarage_private.require_quote_access();
  select * into target from public.quotes where id = $1 for update;
  if not found then raise exception 'Quote not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode='40001', message='Quote version conflict';
  end if;
  if target.status = 'Convertido' then raise exception 'Converted quote is read only'; end if;
  if vehicle is not null and not exists (
    select 1 from public.vehicles v
    where v.id = vehicle and v.customer_id = target.customer_id and v.deleted_at is null
  ) then raise exception 'Vehicle does not belong to this customer'; end if;
  update public.quotes set
    description = coalesce(quote_description, target.description),
    notes = coalesce(quote_notes, target.notes),
    vehicle_id = vehicle,
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
  where id = $1 returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.update_quote(uuid,timestamptz,text,text,uuid) from public, anon;
grant execute on function public.update_quote(uuid,timestamptz,text,text,uuid) to authenticated;

create or replace function public.set_quote_status(
  quote_id uuid, expected_version timestamptz, new_status text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.quotes;
begin
  perform pitgarage_private.require_quote_access();
  if new_status not in ('Rascunho','Enviado','Aprovado','Recusado','Expirado') then
    raise exception 'Invalid quote status';
  end if;
  select * into target from public.quotes where id = $1 for update;
  if not found then raise exception 'Quote not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode='40001', message='Quote version conflict';
  end if;
  if target.status = 'Convertido' then raise exception 'Converted quote is read only'; end if;
  update public.quotes set status = new_status,
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
  where id = $1 returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.set_quote_status(uuid,timestamptz,text) from public, anon;
grant execute on function public.set_quote_status(uuid,timestamptz,text) to authenticated;

create or replace function public.add_quote_item(
  quote_id uuid, expected_version timestamptz, item_id text, item_name text, item_type text,
  unit_cost numeric, markup numeric, quantity integer, unit_price numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.quotes; item jsonb;
begin
  perform pitgarage_private.require_quote_access();
  if item_type not in ('Peça','Serviço') then raise exception 'Invalid item type'; end if;
  if coalesce(btrim(item_name),'') = '' then raise exception 'Item name is required'; end if;
  if quantity is null or quantity < 1 or unit_price is null or unit_price <= 0 then
    raise exception 'Invalid quantity or price';
  end if;
  if item_type = 'Serviço' and (unit_cost is not null or markup is not null) then
    raise exception 'Services do not accept cost or markup';
  end if;
  if (unit_cost is not null or markup is not null) and not public.can_view_financial() then
    raise exception using errcode='42501', message='Financial permission required';
  end if;
  select * into target from public.quotes where id = $1 for update;
  if not found then raise exception 'Quote not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode='40001', message='Quote version conflict';
  end if;
  if target.status = 'Convertido' then raise exception 'Converted quote is read only'; end if;
  if exists (select 1 from jsonb_array_elements(target.items) b where b->>'id' = $3) then
    raise exception using errcode='40001', message='Item already added; reload quote';
  end if;
  item := jsonb_build_object('id', item_id, 'name', btrim(item_name), 'type', item_type,
    'price', round(unit_price * quantity, 2), 'approval', 'Aguardando aprovação', 'executed', false)
    || case when item_type = 'Peça'
      then jsonb_build_object('quantity', quantity, 'unitPrice', unit_price, 'availability', 'Disponível')
      else '{}'::jsonb end;
  update public.quotes set items = coalesce(target.items,'[]'::jsonb) || jsonb_build_array(item),
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
  where id = $1 returning * into target;
  if unit_cost is not null or markup is not null then
    insert into public.quote_item_financials(quote_id, item_id, unit_cost, markup)
    values ($1, item_id, unit_cost, markup)
    on conflict (quote_id, item_id) do update set unit_cost = excluded.unit_cost,
      markup = excluded.markup, updated_at = now();
  end if;
  return to_jsonb(target);
end $$;
revoke all on function public.add_quote_item(uuid,timestamptz,text,text,text,numeric,numeric,integer,numeric) from public, anon;
grant execute on function public.add_quote_item(uuid,timestamptz,text,text,text,numeric,numeric,integer,numeric) to authenticated;

create or replace function public.remove_quote_item(
  quote_id uuid, expected_version timestamptz, item_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.quotes; removed jsonb;
begin
  perform pitgarage_private.require_quote_access();
  select * into target from public.quotes where id = $1 for update;
  if not found then raise exception 'Quote not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode='40001', message='Quote version conflict';
  end if;
  if target.status = 'Convertido' then raise exception 'Converted quote is read only'; end if;
  select b into removed from jsonb_array_elements(target.items) b where b->>'id' = $3;
  if removed is null then
    raise exception using errcode='40001', message='Item not found; reload quote';
  end if;
  delete from public.quote_item_financials f where f.quote_id = $1 and f.item_id = $3;
  update public.quotes set
    items = (select coalesce(jsonb_agg(b order by ordinal),'[]'::jsonb)
      from jsonb_array_elements(target.items) with ordinality entries(b, ordinal)
      where b->>'id' is distinct from $3),
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
  where id = $1 returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.remove_quote_item(uuid,timestamptz,text) from public, anon;
grant execute on function public.remove_quote_item(uuid,timestamptz,text) to authenticated;

create or replace function public.convert_quote_to_order(
  quote_id uuid, expected_version timestamptz, vehicle uuid, entry_mileage integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.quotes; created public.service_orders; chosen_vehicle uuid;
begin
  perform pitgarage_private.require_quote_access();
  select * into target from public.quotes where id = $1 for update;
  if not found then raise exception 'Quote not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode='40001', message='Quote version conflict';
  end if;
  if target.status = 'Convertido' or target.service_order_id is not null then
    raise exception using errcode='40001', message='Quote already converted';
  end if;
  chosen_vehicle := coalesce(vehicle, target.vehicle_id);
  if chosen_vehicle is null then raise exception 'Vehicle is required to open a service order'; end if;
  if not exists (
    select 1 from public.vehicles v
    where v.id = chosen_vehicle and v.customer_id = target.customer_id and v.deleted_at is null
  ) then raise exception 'Vehicle does not belong to this customer'; end if;

  insert into public.service_orders(
    customer_id, vehicle_id, status, entry_mileage, complaint, budget, warranty_days, activities
  ) values (
    target.customer_id, chosen_vehicle, 'Recebido',
    coalesce(entry_mileage, (select v.mileage from public.vehicles v where v.id = chosen_vehicle), 0),
    coalesce(nullif(btrim(target.description), ''), 'Convertido do orçamento ORC-' || target.quote_number),
    coalesce(target.items, '[]'::jsonb), target.warranty_days,
    jsonb_build_array(
      jsonb_build_object('id','a-'||gen_random_uuid(),'type','created','description','OS criada','at',clock_timestamp()),
      jsonb_build_object('id','a-'||gen_random_uuid(),'type','budget',
        'description','OS originada do orçamento ORC-' || target.quote_number,'at',clock_timestamp())
    )
  ) returning * into created;

  insert into public.order_part_financials(order_id, item_id, unit_cost, markup)
  select created.id, f.item_id, f.unit_cost, f.markup
  from public.quote_item_financials f where f.quote_id = $1;

  update public.quotes set status = 'Convertido', service_order_id = created.id,
    vehicle_id = chosen_vehicle, converted_at = clock_timestamp(),
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
  where id = $1;

  return to_jsonb(created);
end $$;
revoke all on function public.convert_quote_to_order(uuid,timestamptz,uuid,integer) from public, anon;
grant execute on function public.convert_quote_to_order(uuid,timestamptz,uuid,integer) to authenticated;

create or replace function public.list_quotes()
returns setof public.quotes language sql stable security definer set search_path = '' as $$
  select q.* from public.quotes q
  where (select pitgarage_private.is_team_member())
  order by q.quote_number desc
$$;
revoke all on function public.list_quotes() from public, anon;
grant execute on function public.list_quotes() to authenticated;

create or replace function public.get_quote_part_financial(quote_id uuid, item_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare row public.quote_item_financials;
begin
  if not public.can_view_financial() then
    raise exception using errcode='42501', message='Financial permission required';
  end if;
  select * into row from public.quote_item_financials f where f.quote_id = $1 and f.item_id = $2;
  return jsonb_build_object('unitCost', row.unit_cost, 'markup', row.markup);
end $$;
revoke all on function public.get_quote_part_financial(uuid,text) from public, anon;
grant execute on function public.get_quote_part_financial(uuid,text) to authenticated;