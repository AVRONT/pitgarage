begin;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('team', 'direct', 'support')),
  title text,
  customer_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);

create function pitgarage_private.can_access_conversation(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = target and (
      (c.kind = 'team' and (select pitgarage_private.is_team_member()))
      or (c.kind = 'direct' and exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
      ))
      or (c.kind = 'support' and (c.customer_user_id = (select auth.uid()) or (select pitgarage_private.is_team_member())))
    )
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.conversation_members, public.messages from public, anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages to authenticated;

create policy conversations_allowed_select on public.conversations for select to authenticated
  using (pitgarage_private.can_access_conversation(id));
create policy conversation_members_allowed_select on public.conversation_members for select to authenticated
  using (pitgarage_private.can_access_conversation(conversation_id));
create policy messages_allowed_select on public.messages for select to authenticated
  using (pitgarage_private.can_access_conversation(conversation_id));

create function public.ensure_my_chat()
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if (select pitgarage_private.current_access_level()) = 'customer' then
    select id into result from public.conversations where kind='support' and customer_user_id=(select auth.uid()) limit 1;
    if result is null then insert into public.conversations(kind,title,customer_user_id) values('support','Atendimento',(select auth.uid())) returning id into result; end if;
  elsif (select pitgarage_private.is_team_member()) then
    select id into result from public.conversations where kind='team' limit 1;
    if result is null then insert into public.conversations(kind,title) values('team','Equipe') returning id into result; end if;
  else raise exception 'authenticated active profile required'; end if;
  insert into public.conversation_members(conversation_id,user_id) values(result,(select auth.uid())) on conflict do nothing;
  return result;
end;
$$;

create function public.list_my_conversations()
returns table(id uuid, kind text, title text, unread_count bigint, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.kind, c.title,
    count(m.id) filter (where m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz)
      and m.sender_user_id is distinct from (select auth.uid())), c.updated_at
  from public.conversations c
  left join public.conversation_members cm on cm.conversation_id=c.id and cm.user_id=(select auth.uid())
  left join public.messages m on m.conversation_id=c.id and m.deleted_at is null
  where pitgarage_private.can_access_conversation(c.id)
  group by c.id, cm.last_read_at order by c.updated_at desc;
$$;

create function public.list_chat_messages(target_conversation uuid)
returns table(id uuid, sender_user_id uuid, sender_name text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not pitgarage_private.can_access_conversation(target_conversation) then raise exception 'access denied'; end if;
  return query select m.id, m.sender_user_id, coalesce(p.full_name,'Usuário removido'), m.body, m.created_at
  from public.messages m left join public.user_profiles p on p.user_id=m.sender_user_id
  where m.conversation_id=target_conversation and m.deleted_at is null order by m.created_at;
end;
$$;

create function public.send_chat_message(target_conversation uuid, message_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if (select auth.uid()) is null then raise exception 'authenticated user required'; end if;
  if not pitgarage_private.can_access_conversation(target_conversation) then raise exception 'access denied'; end if;
  if char_length(btrim(message_body)) not between 1 and 4000 then raise exception 'invalid message'; end if;
  insert into public.messages(conversation_id,sender_user_id,body)
  values(target_conversation,(select auth.uid()),btrim(message_body)) returning id into result;
  update public.conversations set updated_at=now() where id=target_conversation;
  insert into public.notifications(user_id,type,title,message,target)
  select distinct recipient.user_id, 'chat', 'Nova mensagem', 'Você recebeu uma nova mensagem.', '/'
  from (
    select cm.user_id from public.conversation_members cm where cm.conversation_id=target_conversation
    union select p.user_id from public.user_profiles p
      join public.conversations c on c.id=target_conversation and c.kind in ('team','support')
      where p.is_active and p.access_level in ('staff','admin','owner')
    union select c.customer_user_id from public.conversations c where c.id=target_conversation and c.kind='support'
  ) recipient where recipient.user_id is not null and recipient.user_id <> (select auth.uid());
  return result;
end;
$$;

create function public.mark_chat_read(target_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not pitgarage_private.can_access_conversation(target_conversation) then raise exception 'access denied'; end if;
  insert into public.conversation_members(conversation_id,user_id,last_read_at)
  values(target_conversation,(select auth.uid()),now())
  on conflict(conversation_id,user_id) do update set last_read_at=excluded.last_read_at;
end;
$$;

create function public.list_chat_contacts()
returns table(user_id uuid, full_name text) language sql stable security definer set search_path = '' as $$
  select p.user_id, coalesce(p.full_name,'Usuário') from public.user_profiles p
  where (select pitgarage_private.is_team_member()) and p.is_active
    and p.access_level in ('staff','admin','owner') and p.user_id <> (select auth.uid())
  order by p.full_name;
$$;

create function public.start_direct_conversation(target_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not (select pitgarage_private.is_team_member()) or not exists(
    select 1 from public.user_profiles where user_id=target_user and is_active and access_level in ('staff','admin','owner')
  ) then raise exception 'invalid recipient'; end if;
  select c.id into result from public.conversations c
  join public.conversation_members me on me.conversation_id=c.id and me.user_id=(select auth.uid())
  join public.conversation_members them on them.conversation_id=c.id and them.user_id=target_user
  where c.kind='direct' limit 1;
  if result is null then
    insert into public.conversations(kind,title) values('direct','Conversa direta') returning id into result;
    insert into public.conversation_members(conversation_id,user_id) values
      (result,(select auth.uid())),(result,target_user);
  end if;
  return result;
end;
$$;

revoke execute on function pitgarage_private.can_access_conversation(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_my_chat() from public, anon;
grant execute on function public.ensure_my_chat() to authenticated;
revoke execute on function public.list_my_conversations(), public.list_chat_messages(uuid), public.send_chat_message(uuid,text), public.mark_chat_read(uuid), public.list_chat_contacts(), public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.list_my_conversations(), public.list_chat_messages(uuid), public.send_chat_message(uuid,text), public.mark_chat_read(uuid), public.list_chat_contacts(), public.start_direct_conversation(uuid) to authenticated;

alter publication supabase_realtime add table public.notifications, public.messages;

commit;