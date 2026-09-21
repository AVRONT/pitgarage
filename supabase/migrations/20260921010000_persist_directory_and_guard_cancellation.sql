begin;

-- Standalone directory creation uses the same tables and team access as OS creation.
-- The client retains a UUID across retries; no temporary record is exposed as saved.
create function public.create_customer(customer_data jsonb)
returns public.customers language plpgsql security definer set search_path = '' as $$
declare
  result public.customers;
  requested_id uuid := (customer_data->>'id')::uuid;
  customer_name text := btrim(customer_data->>'name');
  customer_phone text := regexp_replace(customer_data->>'phone','[^0-9]','','g');
  customer_email text := lower(btrim(coalesce(customer_data->>'email','')));
  customer_cpf text := nullif(regexp_replace(customer_data->>'cpf','[^0-9]','','g'),'');
  customer_since text := coalesce(customer_data->>'since',extract(year from current_date)::text);
  linked_user uuid;
begin
  if not coalesce(pitgarage_private.is_team_member(),false) then
    raise exception using errcode='42501', message='Somente a equipe pode cadastrar clientes.';
  end if;
  if requested_id is null then raise exception 'Identificador do cadastro obrigatório.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_id::text,1740293104));
  select * into result from public.customers where id=requested_id for update;
  if found then
    if result.deleted_at is not null or result.name is distinct from customer_name
      or result.phone is distinct from customer_phone or result.email is distinct from customer_email
      or result.cpf is distinct from customer_cpf or result.since is distinct from customer_since then
      raise exception 'Identificador já utilizado por outro cadastro. Recarregue os clientes.';
    end if;
    return result;
  end if;
  linked_user := pitgarage_private.find_confirmed_auth_user(customer_email);
  if linked_user is not null and exists(select 1 from public.customers where auth_user_id=linked_user) then
    linked_user := null;
  end if;
  insert into public.customers(id,name,phone,email,cpf,since,auth_user_id)
    values(requested_id,customer_name,customer_phone,customer_email,customer_cpf,customer_since,linked_user)
    returning * into result;
  return result;
end $$;

create function public.create_vehicle(vehicle_data jsonb)
returns public.vehicles language plpgsql security definer set search_path = '' as $$
declare
  result public.vehicles;
  requested_id uuid := (vehicle_data->>'id')::uuid;
  owner_id uuid := (vehicle_data->>'customerId')::uuid;
  vehicle_plate text := upper(regexp_replace(vehicle_data->>'plate','[^A-Za-z0-9]','','g'));
begin
  if not coalesce(pitgarage_private.is_team_member(),false) then
    raise exception using errcode='42501', message='Somente a equipe pode cadastrar veículos.';
  end if;
  if requested_id is null then raise exception 'Identificador do cadastro obrigatório.'; end if;
  perform 1 from public.customers where id=owner_id and deleted_at is null for share;
  if not found then raise exception 'Selecione um cliente ativo e salvo.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_id::text,1740293104));
  select * into result from public.vehicles where id=requested_id for update;
  if found then
    if result.deleted_at is not null or result.customer_id is distinct from owner_id
      or result.kind is distinct from vehicle_data->>'kind'
      or result.brand is distinct from btrim(vehicle_data->>'brand')
      or result.model is distinct from btrim(vehicle_data->>'model')
      or result.year is distinct from (vehicle_data->>'year')::integer
      or result.plate is distinct from vehicle_plate
      or result.mileage is distinct from (vehicle_data->>'mileage')::integer
      or result.color is distinct from vehicle_data->>'color' then
      raise exception 'Identificador já utilizado por outro cadastro. Recarregue os veículos.';
    end if;
    return result;
  end if;
  insert into public.vehicles(id,customer_id,kind,brand,model,year,plate,mileage,color)
    values(requested_id,owner_id,vehicle_data->>'kind',btrim(vehicle_data->>'brand'),
      btrim(vehicle_data->>'model'),(vehicle_data->>'year')::integer,vehicle_plate,
      (vehicle_data->>'mileage')::integer,vehicle_data->>'color') returning * into result;
  return result;
end $$;

revoke all on function public.create_customer(jsonb),public.create_vehicle(jsonb) from public,anon;
grant execute on function public.create_customer(jsonb),public.create_vehicle(jsonb) to authenticated;

-- Invoker context distinguishes direct PostgREST writes from the existing guarded
-- SECURITY DEFINER cancellation RPC, following protect_order_receipts's pattern.
create function pitgarage_private.protect_order_cancellation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op='INSERT' then
      if new.cancelled_at is not null or new.cancelled_by is not null or new.cancel_reason is not null then
        raise exception using errcode='42501', message='Use a operação de cancelamento da OS.';
      end if;
    elsif new.cancelled_at is distinct from old.cancelled_at
      or new.cancelled_by is distinct from old.cancelled_by
      or new.cancel_reason is distinct from old.cancel_reason then
      raise exception using errcode='42501', message='Use a operação de cancelamento da OS.';
    end if;
  end if;
  return new;
end $$;
revoke all on function pitgarage_private.protect_order_cancellation() from public,anon,authenticated;
create trigger protect_order_cancellation before insert or update of cancelled_at,cancelled_by,cancel_reason
  on public.service_orders for each row execute function pitgarage_private.protect_order_cancellation();

commit;
