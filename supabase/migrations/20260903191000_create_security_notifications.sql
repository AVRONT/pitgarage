begin;

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
  device_id_hash text not null,
  email_hash text,
  succeeded boolean not null default false,
  blocked boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);

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
alter table public.notifications enable row level security;
revoke all on public.developer_access, public.access_events, public.registration_attempts, public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;

create policy developer_access_self_select on public.developer_access for select to authenticated
  using (user_id = (select auth.uid()));
create policy access_events_developer_select on public.access_events for select to authenticated
  using (pitgarage_private.has_developer_access((select auth.uid())));
create policy registration_attempts_developer_select on public.registration_attempts for select to authenticated
  using (pitgarage_private.has_developer_access((select auth.uid())));
create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke execute on function pitgarage_private.has_developer_access(uuid) from public, anon, authenticated;
revoke execute on function public.has_developer_access() from public, anon;
revoke execute on function public.get_developer_dashboard() from public, anon;
grant execute on function public.has_developer_access(), public.get_developer_dashboard() to authenticated;

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
