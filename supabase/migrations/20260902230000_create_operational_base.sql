-- Pending migration: apply atomically, without repeating Auth or its bootstrap.
begin;

drop policy user_profiles_select_own_or_manager on public.user_profiles;
create policy user_profiles_select_own_or_manager on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select pitgarage_private.current_access_level()) = 'owner');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text not null check (phone ~ '^[0-9]{10,11}$'),
  email text not null check (btrim(email) = '' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  email_normalized text generated always as (lower(btrim(email))) stored,
  cpf text check (cpf is null or (cpf ~ '^[0-9]{11}$' and cpf !~ '^([0-9])\1{10}$')),
  since text not null default extract(year from current_date)::text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customers_active_email_idx
  on public.customers (email_normalized) where email_normalized <> '';
create unique index customers_active_cpf_idx
  on public.customers (regexp_replace(cpf, '[^0-9]', '', 'g')) where cpf is not null;
create unique index customers_phone_idx on public.customers (phone);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  kind text not null check (kind in ('Carro', 'Moto')),
  brand text not null check (btrim(brand) <> ''),
  model text not null check (btrim(model) <> ''),
  year integer not null check (year between 1900 and 2100),
  plate text not null check (plate ~ '^[A-Z0-9]{7}$'),
  mileage integer not null default 0 check (mileage between 0 and 2000000),
  color text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index vehicles_active_plate_idx
  on public.vehicles (upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g')));
create unique index vehicles_id_customer_id_idx on public.vehicles (id, customer_id);
create index vehicles_customer_id_idx on public.vehicles (customer_id);

create sequence public.service_order_number_seq start with 1;

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('public.service_order_number_seq'),
  customer_id uuid not null references public.customers (id),
  vehicle_id uuid not null references public.vehicles (id),
  status text not null check (status in (
    'Recebido', 'Em diagnóstico', 'Aguardando aprovação', 'Aguardando peça',
    'Em manutenção', 'Serviço concluído', 'Aguardando retirada', 'Entregue'
  )),
  opened_at date not null default current_date,
  completed_at date,
  entry_mileage integer not null check (entry_mileage between 0 and 2000000),
  complaint text not null,
  diagnosis text not null default '',
  findings text not null default '',
  notes text not null default '',
  team jsonb not null default '[]'::jsonb,
  budget jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  payment jsonb,
  status_history jsonb not null default '[]'::jsonb,
  activities jsonb not null default '[]'::jsonb,
  workshop_snapshot jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_orders_vehicle_customer_match foreign key (vehicle_id, customer_id)
    references public.vehicles (id, customer_id),
  constraint service_orders_json_shapes check (
    jsonb_typeof(team) = 'array' and jsonb_typeof(budget) = 'array'
    and jsonb_typeof(evidence) = 'array' and jsonb_typeof(status_history) = 'array'
    and jsonb_typeof(activities) = 'array'
    and (payment is null or jsonb_typeof(payment) = 'object')
    and (workshop_snapshot is null or jsonb_typeof(workshop_snapshot) = 'object')
  )
);
create index service_orders_customer_id_idx on public.service_orders (customer_id);
create index service_orders_vehicle_id_idx on public.service_orders (vehicle_id);

create function pitgarage_private.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pitgarage_private.current_access_level()) in ('staff', 'admin', 'owner'),
    false
  );
$$;

revoke execute on function pitgarage_private.is_team_member() from public, anon;
grant execute on function pitgarage_private.is_team_member() to authenticated;

alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_orders enable row level security;

-- Supabase defaults must not accidentally grant DELETE/TRUNCATE or anonymous access.
revoke all on public.customers, public.vehicles, public.service_orders from public, anon, authenticated;
revoke all on sequence public.service_order_number_seq from public, anon, authenticated;
grant select on public.customers, public.vehicles, public.service_orders to authenticated;
-- New records and account links are created only through the guarded transaction.
grant update (deleted_at, updated_at) on public.customers, public.vehicles to authenticated;
grant update (status, completed_at, entry_mileage, diagnosis, findings, notes, team,
  budget, evidence, payment, status_history, activities, workshop_snapshot, updated_at)
  on public.service_orders to authenticated;

create policy customers_team_all on public.customers for all to authenticated
  using ((select pitgarage_private.is_team_member()))
  with check ((select pitgarage_private.is_team_member()));

create policy vehicles_team_all on public.vehicles for all to authenticated
  using ((select pitgarage_private.is_team_member()))
  with check ((select pitgarage_private.is_team_member()));

create policy service_orders_team_all on public.service_orders for all to authenticated
  using ((select pitgarage_private.is_team_member()))
  with check ((select pitgarage_private.is_team_member()));
create function public.try_link_my_customer()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmed_email text;
  matched_customer_id uuid;
begin
  if (select pitgarage_private.current_access_level()) is distinct from 'customer' then
    raise exception 'only customer accounts can link a customer record';
  end if;

  if exists (select 1 from public.customers where auth_user_id = (select auth.uid())) then
    return (select id from public.customers where auth_user_id = (select auth.uid()) and deleted_at is null);
  end if;

  select lower(btrim(email)) into confirmed_email
  from auth.users
  where id = (select auth.uid()) and email_confirmed_at is not null
  for update;

  if confirmed_email is null or confirmed_email = '' then return null; end if;
  if pitgarage_private.find_confirmed_auth_user(confirmed_email) is distinct from (select auth.uid())
  then return null; end if;

  select id into matched_customer_id
  from public.customers
  where email_normalized = confirmed_email and auth_user_id is null and deleted_at is null
  for update;

  if matched_customer_id is not null then
    update public.customers set auth_user_id = (select auth.uid()), updated_at = now()
    where id = matched_customer_id and auth_user_id is null
    returning id into matched_customer_id;
  end if;
  return matched_customer_id;
end;
$$;

revoke execute on function public.try_link_my_customer() from public, anon;
grant execute on function public.try_link_my_customer() to authenticated;

-- Explicit portal contracts exclude administrative columns and require an active profile.
create function public.get_my_customer()
returns table (id uuid, name text, phone text, email text, cpf text, since text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.phone, c.email, c.cpf, c.since from public.customers c
  where c.auth_user_id = (select auth.uid()) and c.deleted_at is null
    and (select pitgarage_private.current_access_level()) = 'customer';
$$;
revoke execute on function public.get_my_customer() from public, anon;
grant execute on function public.get_my_customer() to authenticated;

create function public.get_my_vehicles()
returns table (id uuid, customer_id uuid, kind text, brand text, model text,
  year integer, plate text, mileage integer, color text)
language sql stable security definer set search_path = ''
as $$
  select v.id, v.customer_id, v.kind, v.brand, v.model, v.year, v.plate, v.mileage, v.color
  from public.vehicles v join public.customers c on c.id = v.customer_id
  where c.auth_user_id = (select auth.uid()) and c.deleted_at is null and v.deleted_at is null
    and (select pitgarage_private.current_access_level()) = 'customer';
$$;
revoke execute on function public.get_my_vehicles() from public, anon;
grant execute on function public.get_my_vehicles() to authenticated;

create function public.get_my_service_orders()
returns table (
  id uuid, order_number bigint, vehicle_id uuid, status text,
  opened_at date, completed_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  select so.id, so.order_number, so.vehicle_id, so.status, so.opened_at, so.completed_at
  from public.service_orders so
  join public.customers c on c.id = so.customer_id
  where c.auth_user_id = (select auth.uid()) and c.deleted_at is null and so.deleted_at is null
    and (select pitgarage_private.current_access_level()) = 'customer'
  order by so.order_number desc;
$$;

revoke execute on function public.get_my_service_orders() from public, anon;
grant execute on function public.get_my_service_orders() to authenticated;

create function pitgarage_private.find_confirmed_auth_user(customer_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (array_agg(u.id))[1]
  from auth.users u
  left join public.user_profiles p on p.user_id = u.id
  where lower(btrim(u.email)) = lower(btrim(customer_email))
    and u.email_confirmed_at is not null
  having count(*) = 1 and bool_and(coalesce(p.access_level = 'customer' and p.is_active, false));
$$;

revoke execute on function pitgarage_private.find_confirmed_auth_user(text) from public, anon, authenticated;

create function public.create_service_order_atomic(
  existing_customer_id uuid,
  new_customer jsonb,
  existing_vehicle_id uuid,
  new_vehicle jsonb,
  order_data jsonb
)
returns public.service_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_customer_id uuid := existing_customer_id;
  resolved_vehicle_id uuid := existing_vehicle_id;
  possible_auth_user_id uuid;
  created_order public.service_orders;
begin
  if not (select pitgarage_private.is_team_member()) then raise exception 'team access required'; end if;

  if (existing_customer_id is null) = (new_customer is null)
    or (existing_vehicle_id is null) = (new_vehicle is null)
  then raise exception 'provide either existing or new customer and vehicle'; end if;
  if nullif(btrim(order_data ->> 'complaint'), '') is null
  then raise exception 'complaint required'; end if;

  if resolved_customer_id is null then
    possible_auth_user_id := pitgarage_private.find_confirmed_auth_user(new_customer ->> 'email');
    if possible_auth_user_id is not null
      and exists (select 1 from public.customers where auth_user_id = possible_auth_user_id)
    then
      possible_auth_user_id := null;
    end if;
    insert into public.customers (name, phone, email, cpf, since, auth_user_id)
    values (
      new_customer ->> 'name', regexp_replace(new_customer ->> 'phone', '[^0-9]', '', 'g'), new_customer ->> 'email',
      nullif(regexp_replace(new_customer ->> 'cpf', '[^0-9]', '', 'g'), ''), coalesce(new_customer ->> 'since', extract(year from current_date)::text),
      possible_auth_user_id
    ) returning id into resolved_customer_id;
  end if;

  perform 1 from public.customers where id = resolved_customer_id and deleted_at is null for update;
  if not found then raise exception 'active customer required'; end if;

  if resolved_vehicle_id is null then
    insert into public.vehicles (customer_id, kind, brand, model, year, plate, mileage, color)
    values (
      resolved_customer_id, new_vehicle ->> 'kind', new_vehicle ->> 'brand', new_vehicle ->> 'model',
      (new_vehicle ->> 'year')::integer, upper(regexp_replace(new_vehicle ->> 'plate', '[^A-Za-z0-9]', '', 'g')),
      (new_vehicle ->> 'mileage')::integer, new_vehicle ->> 'color'
    ) returning id into resolved_vehicle_id;
  end if;

  perform 1 from public.vehicles
    where id = resolved_vehicle_id and customer_id = resolved_customer_id and deleted_at is null
    for update;
  if not found then raise exception 'vehicle does not belong to customer'; end if;

  insert into public.service_orders (
    customer_id, vehicle_id, status, opened_at, entry_mileage, complaint,
    diagnosis, findings, notes, team, budget, evidence, status_history, activities
  ) values (
    resolved_customer_id, resolved_vehicle_id, 'Recebido', current_date,
    (order_data ->> 'entryMileage')::integer, order_data ->> 'complaint', '', '', '',
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'type', 'created', 'description', 'OS criada', 'at', now()
    ))
  ) returning * into created_order;
  return created_order;
end;
$$;

revoke execute on function public.create_service_order_atomic(uuid, jsonb, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_service_order_atomic(uuid, jsonb, uuid, jsonb, jsonb) to authenticated;

create function public.list_team_users()
returns table (
  user_id uuid, full_name text, email text, access_level public.access_level,
  operational_role text, is_active boolean, customer_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.full_name, u.email, p.access_level, p.operational_role, p.is_active, c.id
  from public.user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.customers c on c.auth_user_id = p.user_id
  where (select pitgarage_private.current_access_level()) = 'owner'
  order by p.full_name nulls last, u.email;
$$;

revoke execute on function public.list_team_users() from public, anon;
grant execute on function public.list_team_users() to authenticated;

commit;
