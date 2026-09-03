begin;

create extension if not exists pgcrypto with schema extensions;

create table public.developer_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  label text,
  created_at timestamptz not null default now()
);

create table public.access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  ip_address inet,
  user_agent text,
  device_id_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.registration_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_address inet,
  device_id_hash text,
  email_hash text,
  succeeded boolean not null default false,
  blocked boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);

create table public.registration_rate_limits (
  singleton boolean primary key default true check (singleton),
  device_24h integer not null check (device_24h > 0),
  ip_1h integer not null check (ip_1h > 0),
  ip_24h integer not null check (ip_24h > 0)
);
insert into public.registration_rate_limits (device_24h, ip_1h, ip_24h) values (3, 5, 10);

create table public.registration_invite_exemptions (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  token_hash text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now()
);
create index registration_invite_exemptions_email_idx
  on public.registration_invite_exemptions(email_hash, expires_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index access_events_created_idx on public.access_events(created_at desc);
create index registration_attempts_ip_created_idx on public.registration_attempts(ip_address, created_at desc);
create index registration_attempts_device_created_idx on public.registration_attempts(device_id_hash, created_at desc);

create function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  source_ip inet;
  normalized_email text;
  hashed_email text;
  invite_token_hash text;
  correlated_attempt uuid;
  current_attempt uuid;
  limit_1h integer;
  limit_24h integer;
  attempts_1h bigint;
  attempts_24h bigint;
begin
  begin
    source_ip := nullif(event -> 'metadata' ->> 'ip_address', '')::inet;
  exception when invalid_text_representation then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Cadastro temporariamente indisponível. Tente novamente mais tarde.'
    ));
  end;

  if source_ip is null then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Cadastro temporariamente indisponível. Tente novamente mais tarde.'
    ));
  end if;

  normalized_email := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  hashed_email := encode(extensions.digest(normalized_email, 'sha256'), 'hex');
  invite_token_hash := encode(extensions.digest(
    coalesce(event -> 'user' -> 'user_metadata' ->> 'pitgarage_invite_token', ''),
    'sha256'
  ), 'hex');

  -- Owner invitations create this short-lived server-only exemption. It is consumed once.
  delete from public.registration_invite_exemptions
  where id = (
    select exemption.id from public.registration_invite_exemptions exemption
    where exemption.email_hash = hashed_email
      and exemption.token_hash = invite_token_hash
      and exemption.expires_at > now()
    order by exemption.created_at limit 1 for update skip locked
  );
  if found then return '{}'::jsonb; end if;

  -- Serialize checks per trusted Auth IP so concurrent requests cannot pass together.
  perform pg_advisory_xact_lock(hashtextextended(host(source_ip), 0));
  correlated_attempt := nullif(event -> 'user' -> 'user_metadata' ->> 'registration_attempt_id', '')::uuid;

  if correlated_attempt is not null then
    select attempt.id into current_attempt
    from public.registration_attempts attempt
    where attempt.id = correlated_attempt
      and attempt.ip_address = source_ip
      and attempt.email_hash = hashed_email
      and attempt.reason = 'pending'
      and attempt.created_at > now() - interval '5 minutes'
    for update;
  end if;

  if current_attempt is null then
    insert into public.registration_attempts (ip_address, email_hash, reason)
    values (source_ip, hashed_email, 'auth_hook_pending') returning id into current_attempt;
  end if;

  select ip_1h, ip_24h into limit_1h, limit_24h from public.registration_rate_limits where singleton;
  select count(*) into attempts_1h from public.registration_attempts
    where ip_address = source_ip and created_at > now() - interval '1 hour';
  select count(*) into attempts_24h from public.registration_attempts
    where ip_address = source_ip and created_at > now() - interval '24 hours';

  -- The current row is already included, hence strictly greater than the configured maximum.
  if attempts_1h > limit_1h or attempts_24h > limit_24h then
    update public.registration_attempts set blocked = true, reason = 'auth_hook_ip_limit'
    where id = current_attempt;
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Limite temporário de cadastros atingido. Tente novamente mais tarde.'
    ));
  end if;

  update public.registration_attempts set reason = 'auth_hook_allowed' where id = current_attempt;
  return '{}'::jsonb;
exception
  when invalid_text_representation then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Cadastro temporariamente indisponível. Tente novamente mais tarde.'
    ));
end;
$$;

create function pitgarage_private.has_developer_access(target uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.developer_access d where d.user_id = target and d.is_active);
$$;

create function public.has_developer_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select pitgarage_private.has_developer_access((select auth.uid()));
$$;

create function public.get_developer_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not pitgarage_private.has_developer_access((select auth.uid())) then raise exception 'developer access required'; end if;
  return jsonb_build_object(
    'access_events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id,user_id,event_type,ip_address::text,user_agent,device_id_hash,metadata,created_at from public.access_events order by created_at desc limit 100) e), '[]'::jsonb),
    'registration_attempts', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select id,ip_address::text,device_id_hash,succeeded,blocked,reason,created_at from public.registration_attempts order by created_at desc limit 100) r), '[]'::jsonb),
    'blocked_24h', (select count(*) from public.registration_attempts where blocked and created_at > now() - interval '24 hours'),
    'attempts_24h', (select count(*) from public.registration_attempts where created_at > now() - interval '24 hours')
  );
end;
$$;

alter table public.developer_access enable row level security;
alter table public.access_events enable row level security;
alter table public.registration_attempts enable row level security;
alter table public.registration_rate_limits enable row level security;
alter table public.registration_invite_exemptions enable row level security;
alter table public.notifications enable row level security;
revoke all on public.developer_access, public.access_events, public.registration_attempts,
  public.registration_rate_limits, public.registration_invite_exemptions, public.notifications
  from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

create policy developer_access_self_select on public.developer_access for select to authenticated
  using (user_id = (select auth.uid()));
create policy access_events_developer_select on public.access_events for select to authenticated
  using (pitgarage_private.has_developer_access((select auth.uid())));
create policy registration_attempts_developer_select on public.registration_attempts for select to authenticated
  using (pitgarage_private.has_developer_access((select auth.uid())));
create policy registration_attempts_auth_hook on public.registration_attempts for all to supabase_auth_admin
  using (true) with check (true);
create policy registration_limits_auth_hook on public.registration_rate_limits for select to supabase_auth_admin
  using (true);
create policy registration_exemptions_auth_hook on public.registration_invite_exemptions for delete to supabase_auth_admin
  using (true);
create policy registration_exemptions_auth_hook_select on public.registration_invite_exemptions for select to supabase_auth_admin
  using (true);
create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke execute on function pitgarage_private.has_developer_access(uuid) from public, anon, authenticated;
revoke execute on function public.has_developer_access() from public, anon;
revoke execute on function public.get_developer_dashboard() from public, anon;
grant execute on function public.has_developer_access(), public.get_developer_dashboard() to authenticated;

grant usage on schema public, extensions to supabase_auth_admin;
grant select, insert, update on public.registration_attempts to supabase_auth_admin;
grant select on public.registration_rate_limits to supabase_auth_admin;
grant select, delete on public.registration_invite_exemptions to supabase_auth_admin;
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;

create function public.list_my_notifications()
returns setof public.notifications language sql stable security definer set search_path = '' as $$
  select n.* from public.notifications n where n.user_id=(select auth.uid()) order by n.created_at desc limit 50;
$$;
create function public.mark_my_notifications_read(notification_id uuid default null)
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at=now() where user_id=(select auth.uid()) and read_at is null
    and (notification_id is null or id=notification_id);
$$;
revoke execute on function public.list_my_notifications(), public.mark_my_notifications_read(uuid) from public, anon;
grant execute on function public.list_my_notifications(), public.mark_my_notifications_read(uuid) to authenticated;

create function pitgarage_private.notify_customer_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  if old.status is not distinct from new.status then return new; end if;
  select c.auth_user_id into recipient from public.customers c where c.id=new.customer_id;
  if recipient is not null and new.status in ('Aguardando aprovaÃ§Ã£o','ServiÃ§o concluÃ­do','Aguardando retirada','Entregue') then
    insert into public.notifications(user_id,type,title,message,target,metadata)
    values(recipient,'service_order','AtualizaÃ§Ã£o da OS',format('A OS %s agora estÃ¡ em %s.',new.order_number,new.status),'/cliente',jsonb_build_object('service_order_id',new.id));
  end if;
  return new;
end;
$$;
create trigger service_order_customer_notification after update of status on public.service_orders
for each row execute function pitgarage_private.notify_customer_order_status();
revoke execute on function pitgarage_private.notify_customer_order_status() from public, anon, authenticated;

commit;
