-- Prepared locally only. Requires existing Auth, operational and security/chat bases.
-- Does not replace chat RPCs, notifications, workflow or any Agenda object.
begin;

create table pitgarage_private.abuse_buckets (
  action text not null,
  subject text not null,
  window_seconds integer not null check (window_seconds > 0),
  started_at timestamptz not null,
  used integer not null check (used > 0),
  primary key (action, subject, window_seconds)
);
alter table pitgarage_private.abuse_buckets enable row level security;
revoke all on pitgarage_private.abuse_buckets from public, anon, authenticated, service_role;

-- One bounded row per actor/action/window. Atomic UPSERT serializes concurrent calls.
-- Fixed windows start with the first accepted request (not a sliding-window guarantee).
create function pitgarage_private.consume_abuse_budget(
  action_name text, subject_key text, maximum integer, seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare instant timestamptz := clock_timestamp();
begin
  if maximum <= 0 or seconds <= 0 or subject_key is null then
    raise exception 'invalid abuse budget';
  end if;
  insert into pitgarage_private.abuse_buckets as bucket
    (action, subject, window_seconds, started_at, used)
  values (action_name, subject_key, seconds, instant, 1)
  on conflict (action, subject, window_seconds) do update
    set started_at = case when bucket.started_at <= instant - make_interval(secs => seconds)
                          then instant else bucket.started_at end,
        used = case when bucket.started_at <= instant - make_interval(secs => seconds)
                    then 1 else bucket.used + 1 end
    where bucket.started_at <= instant - make_interval(secs => seconds)
       or bucket.used < maximum;
  return found;
end;
$$;
revoke all on function pitgarage_private.consume_abuse_budget(text,text,integer,integer)
  from public, anon, authenticated, service_role;

-- Table triggers cover RPC calls and any future direct-write grant.
-- Counters commit with successful mutations; failed/rolled-back writes do not consume quota.
create function pitgarage_private.guard_operational_abuse()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'Autenticação necessária.';
  end if;
  if tg_table_name = 'messages' then
    if new.sender_user_id is distinct from actor
      or not exists (select 1 from public.user_profiles where user_id = actor and is_active)
      or not pitgarage_private.can_access_conversation(new.conversation_id) then
      raise exception using errcode = '42501', message = 'Sem permissão para enviar nesta conversa.';
    end if;
    if not pitgarage_private.consume_abuse_budget('chat', actor::text, 120, 60)
      or not pitgarage_private.consume_abuse_budget('chat', actor::text, 2000, 3600) then
      raise exception using errcode = 'PT429', message = 'Muitas mensagens em pouco tempo. Aguarde e tente novamente.';
    end if;
  elsif tg_table_name = 'service_orders' then
    if not pitgarage_private.is_team_member() then
      raise exception using errcode = '42501', message = 'Acesso da equipe necessário.';
    end if;
    if not pitgarage_private.consume_abuse_budget('new_order', actor::text, 30, 60)
      or not pitgarage_private.consume_abuse_budget('new_order', actor::text, 300, 3600) then
      raise exception using errcode = 'PT429', message = 'Muitas ordens em pouco tempo. Aguarde e tente novamente.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function pitgarage_private.guard_operational_abuse()
  from public, anon, authenticated, service_role;
create trigger guard_chat_abuse before insert on public.messages
  for each row execute function pitgarage_private.guard_operational_abuse();
create trigger guard_new_order_abuse before insert on public.service_orders
  for each row execute function pitgarage_private.guard_operational_abuse();

-- Additional defense independent of the invoker RPC/RLS. Existing trigger is preserved.
create function pitgarage_private.guard_team_abuse()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if new.access_level = 'owner' then
      raise exception using errcode = '42501', message = 'Não é permitido criar outro proprietário.';
    end if;
    return new; -- Auth-created customer profile remains unchanged.
  end if;
  if tg_op = 'DELETE' then
    if old.access_level = 'owner' then
      raise exception using errcode = '42501', message = 'O proprietário atual está protegido.';
    end if;
    return old;
  end if;
  if actor is null or pitgarage_private.current_access_level() is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'Somente o proprietário pode alterar a equipe.';
  end if;
  if new.user_id is distinct from old.user_id
    or (new.access_level = 'owner' and old.access_level <> 'owner')
    or (old.access_level = 'owner' and (new.access_level <> 'owner' or not new.is_active)) then
    raise exception using errcode = '42501', message = 'O proprietário e a identidade do perfil estão protegidos.';
  end if;
  if not pitgarage_private.consume_abuse_budget('team', actor::text, 30, 60)
    or not pitgarage_private.consume_abuse_budget('team', actor::text, 200, 3600) then
    raise exception using errcode = 'PT429', message = 'Muitas alterações na equipe. Aguarde e tente novamente.';
  end if;
  return new;
end;
$$;
revoke all on function pitgarage_private.guard_team_abuse()
  from public, anon, authenticated, service_role;
create trigger guard_team_abuse before insert or update or delete on public.user_profiles
  for each row execute function pitgarage_private.guard_team_abuse();

-- Service-only reservation before calling Auth Admin; no client-supplied actor is trusted.
create function public.reserve_invite_budget(owner_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_profiles
    where user_id = owner_id and is_active and access_level = 'owner') then
    raise exception using errcode = '42501', message = 'Somente o proprietário pode enviar convites.';
  end if;
  if not pitgarage_private.consume_abuse_budget('invite', owner_id::text, 20, 3600) then
    return false;
  end if;
  return pitgarage_private.consume_abuse_budget('invite', owner_id::text, 50, 86400);
end;
$$;
revoke all on function public.reserve_invite_budget(uuid) from public, anon, authenticated;
grant execute on function public.reserve_invite_budget(uuid) to service_role;

-- Reuses existing records/configuration and the lock used by before_user_created.
-- Reserve before Auth: counts pending attempts too, closing the count/insert race.
create function public.reserve_registration_attempt(
  client_ip inet, device_hash text, email_hash_value text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  limits public.registration_rate_limits;
  reserved uuid;
begin
  if client_ip is null or device_hash !~ '^[a-f0-9]{64}$'
    or email_hash_value !~ '^[a-f0-9]{64}$'
    or device_hash is null or email_hash_value is null then
    raise exception 'invalid registration reservation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(host(client_ip), 0));
  perform pg_advisory_xact_lock(hashtextextended('registration-device:' || device_hash, 0));
  select * into strict limits from public.registration_rate_limits where singleton;
  if (select count(*) from public.registration_attempts
      where ip_address = client_ip and created_at > now() - interval '1 hour') >= limits.ip_1h
    or (select count(*) from public.registration_attempts
      where ip_address = client_ip and created_at > now() - interval '24 hours') >= limits.ip_24h
    or (select count(*) from public.registration_attempts
      where device_id_hash = device_hash and created_at > now() - interval '24 hours'
      and (succeeded or (reason in ('pending', 'auth_hook_allowed')
        and created_at > now() - interval '5 minutes'))) >= limits.device_24h then
    return null;
  end if;
  insert into public.registration_attempts(ip_address, device_id_hash, email_hash, reason)
    values (client_ip, device_hash, email_hash_value, 'pending') returning id into reserved;
  return reserved;
end;
$$;
revoke all on function public.reserve_registration_attempt(inet,text,text) from public, anon, authenticated;
grant execute on function public.reserve_registration_attempt(inet,text,text) to service_role;
commit;
