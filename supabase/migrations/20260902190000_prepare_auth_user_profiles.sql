-- PROPOSAL ONLY: this migration must not be applied until the architecture and
-- provisional permission rules have been validated with the workshop.

create type public.access_level as enum ('owner', 'admin', 'staff');

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  operational_role text,
  access_level public.access_level not null default 'staff',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_full_name_length check (
    full_name is null or (char_length(btrim(full_name)) between 1 and 120)
  ),
  constraint user_profiles_operational_role_length check (
    operational_role is null or (char_length(btrim(operational_role)) between 1 and 80)
  ),
  constraint user_profiles_active_identity_required check (
    not is_active or (full_name is not null and operational_role is not null)
  )
);

comment on table public.user_profiles is
  'Proposed application profile linked to Supabase Auth. Never stores passwords.';
comment on column public.user_profiles.operational_role is
  'Operational job title, independent from access_level; examples require business validation.';

create index user_profiles_active_access_level_idx
  on public.user_profiles (access_level)
  where is_active;

create schema if not exists pitgarage_private;
revoke all on schema pitgarage_private from public;

create function pitgarage_private.current_access_level()
returns public.access_level
language sql
stable
security definer
set search_path = ''
as $$
  select profile.access_level
  from public.user_profiles as profile
  where profile.user_id = (select auth.uid())
    and profile.is_active;
$$;

create function pitgarage_private.is_existing_owner(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles as profile
    where profile.user_id = target_user_id
      and profile.access_level = 'owner'
  );
$$;

revoke execute on function pitgarage_private.current_access_level() from public, anon;
revoke execute on function pitgarage_private.is_existing_owner(uuid) from public, anon;
grant usage on schema pitgarage_private to authenticated;
grant execute on function pitgarage_private.current_access_level() to authenticated;
grant execute on function pitgarage_private.is_existing_owner(uuid) to authenticated;

create function pitgarage_private.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id);
  return new;
end;
$$;

revoke execute on function pitgarage_private.create_profile_for_new_auth_user() from public, anon, authenticated;

create trigger create_profile_after_auth_user
  after insert on auth.users
  for each row execute function pitgarage_private.create_profile_for_new_auth_user();

create function pitgarage_private.protect_user_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'user_id cannot be changed';
  end if;

  if old.access_level = 'owner'
    and (new.access_level <> 'owner' or not new.is_active)
  then
    raise exception 'owner deactivation or demotion requires an approved recovery procedure';
  end if;

  new.full_name := nullif(btrim(new.full_name), '');
  new.operational_role := nullif(btrim(new.operational_role), '');
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function pitgarage_private.protect_user_profile_fields() from public, anon, authenticated;

create trigger protect_user_profile_before_update
  before update on public.user_profiles
  for each row execute function pitgarage_private.protect_user_profile_fields();

alter table public.user_profiles enable row level security;

revoke all on table public.user_profiles from anon, authenticated;
grant select on table public.user_profiles to authenticated;
grant update (full_name, operational_role, access_level, is_active)
  on table public.user_profiles to authenticated;

create policy user_profiles_select_own_or_manager
on public.user_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select pitgarage_private.current_access_level()) in ('owner', 'admin')
);

create policy user_profiles_owner_update
on public.user_profiles
for update
to authenticated
using (
  (select pitgarage_private.current_access_level()) = 'owner'
)
with check (
  (select pitgarage_private.current_access_level()) = 'owner'
  and (
    access_level in ('staff', 'admin')
    or (
      access_level = 'owner'
      and (select pitgarage_private.is_existing_owner(user_id))
    )
  )
);

create policy user_profiles_admin_update_staff
on public.user_profiles
for update
to authenticated
using (
  (select pitgarage_private.current_access_level()) = 'admin'
  and access_level = 'staff'
)
with check (
  (select pitgarage_private.current_access_level()) = 'admin'
  and access_level = 'staff'
);

create function public.administer_user_profile(
  target_user_id uuid,
  new_full_name text,
  new_operational_role text,
  new_access_level public.access_level,
  new_is_active boolean
)
returns public.user_profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_profile public.user_profiles;
begin
  update public.user_profiles
  set full_name = new_full_name,
      operational_role = new_operational_role,
      access_level = new_access_level,
      is_active = new_is_active
  where user_id = target_user_id
  returning * into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'profile not found or caller is not allowed to administer it';
  end if;

  return updated_profile;
end;
$$;

revoke execute on function public.administer_user_profile(uuid, text, text, public.access_level, boolean)
  from public, anon;
grant execute on function public.administer_user_profile(uuid, text, text, public.access_level, boolean)
  to authenticated;

create function pitgarage_private.bootstrap_first_owner(
  target_user_id uuid,
  owner_full_name text,
  owner_operational_role text
)
returns public.user_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  promoted_profile public.user_profiles;
begin
  if owner_full_name is null or btrim(owner_full_name) = ''
    or owner_operational_role is null or btrim(owner_operational_role) = ''
  then
    raise exception 'confirmed owner name and operational role are required';
  end if;

  lock table public.user_profiles in share row exclusive mode;

  if exists (
    select 1
    from public.user_profiles
    where access_level = 'owner'
  ) then
    raise exception 'an owner already exists; bootstrap is single-use';
  end if;

  update public.user_profiles
  set full_name = owner_full_name,
      operational_role = owner_operational_role,
      access_level = 'owner',
      is_active = true
  where user_id = target_user_id
  returning * into promoted_profile;

  if promoted_profile.user_id is null then
    raise exception 'target auth user/profile does not exist';
  end if;

  return promoted_profile;
end;
$$;

revoke execute on function pitgarage_private.bootstrap_first_owner(uuid, text, text) from public, anon, authenticated, service_role;
