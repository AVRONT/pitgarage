-- 1. Shared authorization helper: owner or technical admin may administer access.
create or replace function pitgarage_private.can_administer()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select pitgarage_private.current_access_level()) in ('owner','admin'), false);
$$;
grant execute on function pitgarage_private.can_administer() to authenticated;

-- 2. Structural guard: the workshop must always keep at least one active owner.
create or replace function pitgarage_private.guard_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.access_level = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.access_level <> 'owner' or not new.is_active) then
    if not exists (
      select 1 from public.user_profiles p
      where p.access_level = 'owner' and p.is_active and p.user_id <> old.user_id
    ) then
      raise exception using errcode = '42501',
        message = 'A oficina precisa manter ao menos um proprietário ativo.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists guard_last_owner on public.user_profiles;
create trigger guard_last_owner before update or delete on public.user_profiles
for each row execute function pitgarage_private.guard_last_owner();

-- 3. Field protection: admin manages non-owner levels; owner may promote/demote owners.
create or replace function pitgarage_private.protect_user_profile_fields()
returns trigger language plpgsql set search_path = '' as $$
declare actor_level public.access_level := (select pitgarage_private.current_access_level());
begin
  if new.user_id <> old.user_id then
    raise exception 'user_id cannot be changed';
  end if;

  if (select auth.uid()) is not null then
    if new.access_level is distinct from old.access_level
      and actor_level is distinct from 'owner'
      and actor_level is distinct from 'admin' then
      raise exception 'only owner or admin can change access_level';
    end if;
    if actor_level is distinct from 'owner'
      and (old.access_level = 'owner' or new.access_level = 'owner') then
      raise exception 'only owner can manage owner accounts';
    end if;
  end if;

  new.full_name := nullif(btrim(new.full_name), '');
  new.operational_role := nullif(btrim(new.operational_role), '');
  new.updated_at := now();
  return new;
end $$;

-- 4. Abuse guard follows the same authorization model.
create or replace function pitgarage_private.guard_team_abuse()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
  actor_level public.access_level := pitgarage_private.current_access_level();
begin
  if tg_op = 'INSERT' then
    if new.access_level = 'owner' then
      raise exception using errcode = '42501', message = 'Não é permitido criar outro proprietário.';
    end if;
    return new; -- Auth-created customer profile remains unchanged.
  end if;
  if tg_op = 'DELETE' then
    if old.access_level = 'owner' then
      raise exception using errcode = '42501', message = 'Contas de proprietário estão protegidas.';
    end if;
    return old;
  end if;
  if actor is null or actor_level not in ('owner','admin') then
    raise exception using errcode = '42501', message = 'Somente proprietário ou administrador pode alterar a equipe.';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception using errcode = '42501', message = 'A identidade do perfil está protegida.';
  end if;
  if actor_level <> 'owner' and (old.access_level = 'owner' or new.access_level = 'owner') then
    raise exception using errcode = '42501', message = 'Somente o proprietário gerencia contas de proprietário.';
  end if;
  if not pitgarage_private.consume_abuse_budget('team', actor::text, 30, 60)
    or not pitgarage_private.consume_abuse_budget('team', actor::text, 200, 3600) then
    raise exception using errcode = 'PT429', message = 'Muitas alterações na equipe. Aguarde e tente novamente.';
  end if;
  return new;
end $$;

-- 5. RLS: admin reads and updates non-owner profiles; owner keeps full control.
drop policy if exists user_profiles_select_own_or_manager on public.user_profiles;
create policy user_profiles_select_own_or_manager on public.user_profiles
for select to authenticated
using (user_id = (select auth.uid()) or (select pitgarage_private.can_administer()));

drop policy if exists user_profiles_owner_update on public.user_profiles;
drop policy if exists user_profiles_manager_update on public.user_profiles;
create policy user_profiles_manager_update on public.user_profiles
for update to authenticated
using (
  case (select pitgarage_private.current_access_level())
    when 'owner' then true
    when 'admin' then access_level <> 'owner'
    else false end)
with check (
  case (select pitgarage_private.current_access_level())
    when 'owner' then true
    when 'admin' then access_level <> 'owner'
    else false end);

-- 6. Team screen lists internal accounts only.
create or replace function public.list_team_users()
returns table(user_id uuid, full_name text, email text, access_level access_level,
  operational_role text, is_active boolean, customer_id uuid)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.full_name, u.email, p.access_level, p.operational_role, p.is_active, c.id
  from public.user_profiles p
  join auth.users u on u.id = p.user_id
  left join public.customers c on c.auth_user_id = p.user_id
  where (select pitgarage_private.can_administer())
    and p.access_level in ('owner','admin','staff')
  order by p.full_name nulls last, u.email;
$$;

-- 7. Financial permission management and invites follow the same administrator model.
create or replace function public.list_financial_members()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not pitgarage_private.can_administer() then
    raise exception using errcode='42501', message='Administrator access required'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'full_name',p.full_name,
    'owner',p.access_level='owner','allowed',p.access_level='owner' or f.user_id is not null) order by p.full_name),'[]'::jsonb)
    from public.user_profiles p left join public.financial_permissions f using(user_id)
    where p.is_active and p.access_level in ('owner','admin','staff'));
end $$;

create or replace function public.set_financial_permission(target_user uuid, allowed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.user_profiles;
begin
  if not pitgarage_private.can_administer() then
    raise exception using errcode='42501', message='Administrator access required'; end if;
  select * into target from public.user_profiles where user_id=target_user for update;
  if not found or not target.is_active or target.access_level not in ('admin','staff') then
    raise exception 'Only active admin/staff permissions may be changed'; end if;
  if allowed then insert into public.financial_permissions(user_id) values(target_user) on conflict do nothing;
  else delete from public.financial_permissions where user_id=target_user; end if;
end $$;

create or replace function public.reserve_invite_budget(owner_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_profiles
    where user_id = owner_id and is_active and access_level in ('owner','admin')) then
    raise exception using errcode = '42501', message = 'Somente proprietário ou administrador pode enviar convites.';
  end if;
  if not pitgarage_private.consume_abuse_budget('invite', owner_id::text, 20, 3600) then
    return false;
  end if;
  return pitgarage_private.consume_abuse_budget('invite', owner_id::text, 50, 86400);
end $$;
