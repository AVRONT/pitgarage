alter table public.quotes
  add column contact_name text,
  add column contact_phone text,
  add column contact_email text,
  alter column customer_id drop not null,
  add constraint quotes_party_check check (
    customer_id is not null
    or (coalesce(btrim(contact_name), '') <> '' and coalesce(btrim(contact_phone), '') <> '')
  );

drop function if exists public.create_quote(uuid, uuid, text, text);

create or replace function public.create_quote(
  customer uuid, vehicle uuid, quote_description text, quote_notes text,
  contact_name text default null, contact_phone text default null, contact_email text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare created public.quotes;
begin
  perform pitgarage_private.require_quote_access();
  if customer is null then
    if coalesce(btrim(contact_name), '') = '' or coalesce(btrim(contact_phone), '') = '' then
      raise exception 'Contact name and phone are required for a quote without a customer';
    end if;
    if vehicle is not null then
      raise exception 'A quote without a customer cannot reference a vehicle';
    end if;
  elsif vehicle is not null and not exists (
    select 1 from public.vehicles v
    where v.id = vehicle and v.customer_id = customer and v.deleted_at is null
  ) then
    raise exception 'Vehicle does not belong to this customer';
  end if;
  insert into public.quotes(
    customer_id, vehicle_id, description, notes, created_by,
    contact_name, contact_phone, contact_email
  ) values (
    customer, vehicle, coalesce(quote_description, ''), coalesce(quote_notes, ''), auth.uid(),
    case when customer is null then btrim(contact_name) end,
    case when customer is null then btrim(contact_phone) end,
    case when customer is null then nullif(btrim(contact_email), '') end
  ) returning * into created;
  return to_jsonb(created);
end $$;
revoke all on function public.create_quote(uuid, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_quote(uuid, uuid, text, text, text, text, text) to authenticated;

create or replace function public.match_quote_contact(quote_id uuid)
returns table(id uuid, name text, phone text, email text)
language plpgsql stable security definer set search_path = '' as $$
declare target public.quotes; digits text; mail text;
begin
  perform pitgarage_private.require_quote_access();
  select * into target from public.quotes q where q.id = $1;
  if not found then raise exception 'Quote not found'; end if;
  if target.customer_id is not null then return; end if;
  digits := nullif(regexp_replace(coalesce(target.contact_phone, ''), '\D', '', 'g'), '');
  mail := nullif(lower(btrim(coalesce(target.contact_email, ''))), '');
  if digits is not null and length(digits) < 8 then digits := null; end if;
  return query
    select c.id, c.name, c.phone, c.email
    from public.customers c
    where c.deleted_at is null
      and ((digits is not null and regexp_replace(c.phone, '\D', '', 'g') = digits)
        or (mail is not null and lower(btrim(c.email)) = mail))
    order by c.created_at;
end $$;
revoke all on function public.match_quote_contact(uuid) from public, anon;
grant execute on function public.match_quote_contact(uuid) to authenticated;

create or replace function public.link_quote_customer(
  quote_id uuid, expected_version timestamptz, existing_customer uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.quotes; linked uuid; fresh public.customers; digits text; mail text; candidates int;
begin
  perform pitgarage_private.require_quote_access();
  select * into target from public.quotes where id = $1 for update;
  if not found then raise exception 'Quote not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode = '40001', message = 'Quote version conflict';
  end if;
  if target.status = 'Convertido' then raise exception 'Converted quote is read only'; end if;
  if target.customer_id is not null then
    raise exception using errcode = '40001', message = 'Quote already linked to a customer';
  end if;

  if existing_customer is not null then
    if not exists (
      select 1 from public.customers c where c.id = existing_customer and c.deleted_at is null
    ) then raise exception 'Customer not found'; end if;
    linked := existing_customer;
  else
    digits := nullif(regexp_replace(coalesce(target.contact_phone, ''), '\D', '', 'g'), '');
    mail := nullif(lower(btrim(coalesce(target.contact_email, ''))), '');
    if digits is not null and length(digits) < 8 then digits := null; end if;
    if digits is null and mail is null then
      raise exception 'Contact has no valid phone or e-mail to link';
    end if;
    select count(*) into candidates
    from public.customers c
    where c.deleted_at is null
      and ((digits is not null and regexp_replace(c.phone, '\D', '', 'g') = digits)
        or (mail is not null and lower(btrim(c.email)) = mail));
    if candidates > 0 then
      raise exception using errcode = '40001',
        message = 'Existe cliente compatível; escolha qual deseja vincular';
    end if;
    insert into public.customers(name, phone, email)
    values (
      btrim(target.contact_name),
      btrim(target.contact_phone),
      coalesce(nullif(btrim(target.contact_email), ''), '')
    ) returning * into fresh;
    linked := fresh.id;
  end if;

  update public.quotes set customer_id = linked,
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
  where id = $1 returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.link_quote_customer(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.link_quote_customer(uuid, timestamptz, uuid) to authenticated;

create or replace function public.convert_quote_to_order(
  quote_id uuid, expected_version timestamptz, vehicle uuid, entry_mileage integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.quotes; created public.service_orders; chosen_vehicle uuid;
begin
  perform pitgarage_private.require_quote_access();
  select * into target from public.quotes where id = $1 for update;
  if not found then raise exception 'Quote not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode = '40001', message = 'Quote version conflict';
  end if;
  if target.status = 'Convertido' or target.service_order_id is not null then
    raise exception using errcode = '40001', message = 'Quote already converted';
  end if;
  if target.customer_id is null then
    raise exception 'Link this quote to a customer before opening a service order';
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

create or replace function public.remove_budget_item(order_id uuid, expected_version timestamptz, item_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.service_orders; removed jsonb;
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin','staff'), true) then
    raise exception using errcode = '42501', message = 'Workshop access required';
  end if;
  select * into target from public.service_orders where id = $1 for update;
  if not found then raise exception 'Order not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode = '40001', message = 'Order version conflict';
  end if;
  select b into removed from jsonb_array_elements(target.budget) b where b->>'id' = $3;
  if removed is null then
    raise exception using errcode = '40001', message = 'Item not found; reload order';
  end if;
  if coalesce(removed->>'executed', 'false') <> 'false' then
    raise exception 'This item was already executed and stays in the order history';
  end if;
  if target.cancelled_at is not null then
    raise exception 'Cancelled order is read only';
  end if;
  if target.status in ('Serviço concluído','Aguardando retirada','Entregue') or target.completed_at is not null then
    raise exception 'Completed or delivered order is read only';
  end if;
  if target.payment is not null then
    raise exception 'Order has a registered payment; removing this item needs manual handling';
  end if;
  if target.status not in ('Recebido','Em diagnóstico','Aguardando aprovação')
    and coalesce(removed->>'approval', '') <> 'Recusado' then
    raise exception 'At this stage only refused items that were never executed can be removed';
  end if;
  delete from public.order_part_financials f where f.order_id = $1 and f.item_id = $3;
  update public.service_orders set
    budget = (select coalesce(jsonb_agg(b order by ordinal),'[]'::jsonb)
      from jsonb_array_elements(target.budget) with ordinality entries(b, ordinal)
      where b->>'id' is distinct from $3),
    activities = coalesce(target.activities,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id','a-'||gen_random_uuid(),'type','budget',
      'description','Item removido do orçamento: '||(removed->>'name'),'at',clock_timestamp())),
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
  where id = $1 returning * into target;
  return to_jsonb(target);
end $$;