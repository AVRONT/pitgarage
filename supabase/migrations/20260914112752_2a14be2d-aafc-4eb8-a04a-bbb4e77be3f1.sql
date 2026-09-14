begin;

create table public.workshop_settings (
  id boolean primary key default true,
  name text not null default 'Oficina Pit Stop',
  legal_name text not null default '',
  cnpj text not null default '',
  phone text not null default '',
  address text not null default '',
  postal_code text not null default '',
  hours text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint workshop_settings_singleton check (id),
  constraint workshop_settings_name_present check (btrim(name) <> '')
);

grant select, update on public.workshop_settings to authenticated;
grant all on public.workshop_settings to service_role;

alter table public.workshop_settings enable row level security;

create policy workshop_settings_team_select on public.workshop_settings
  for select to authenticated
  using ((select pitgarage_private.is_team_member()));

create policy workshop_settings_admin_update on public.workshop_settings
  for update to authenticated
  using ((select pitgarage_private.can_administer()))
  with check ((select pitgarage_private.can_administer()));

create function public.stamp_workshop_settings() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.id := true;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger workshop_settings_stamp before update on public.workshop_settings
  for each row execute function public.stamp_workshop_settings();

insert into public.workshop_settings(id) values(true);

commit;