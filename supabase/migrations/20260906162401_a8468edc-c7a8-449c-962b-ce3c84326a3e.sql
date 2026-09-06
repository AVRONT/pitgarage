begin;

-- The previous chat function created one notification per message without a conversation id.
-- Preserve those rows, but clear their unread state once before enabling grouped notifications.
update public.notifications
set read_at = now()
where type = 'chat'
  and read_at is null
  and not (metadata ? 'conversation_id');

create unique index notifications_unread_chat_conversation_idx
  on public.notifications (user_id, ((metadata ->> 'conversation_id')))
  where type = 'chat'
    and read_at is null
    and metadata ? 'conversation_id';

drop function public.list_my_conversations();

create function public.list_my_conversations()
returns table(
  id uuid,
  kind text,
  title text,
  display_name text,
  unread_count bigint,
  last_message text,
  last_message_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.kind,
    c.title,
    case
      when c.kind = 'team' then 'Equipe'
      when c.kind = 'direct' then coalesce(other_profile.full_name, 'Usuário removido')
      when c.kind = 'support' and (select pitgarage_private.is_team_member())
        then coalesce(customer_profile.full_name, 'Cliente removido')
      when c.kind = 'support' then 'Atendimento'
      else coalesce(c.title, 'Conversa')
    end as display_name,
    (
      select count(*)
      from public.messages unread_message
      where unread_message.conversation_id = c.id
        and unread_message.deleted_at is null
        and unread_message.created_at > coalesce(current_member.last_read_at, '-infinity'::timestamptz)
        and unread_message.sender_user_id is distinct from (select auth.uid())
    ) as unread_count,
    latest.body as last_message,
    latest.created_at as last_message_at,
    c.updated_at
  from public.conversations c
  left join public.conversation_members current_member
    on current_member.conversation_id = c.id
    and current_member.user_id = (select auth.uid())
  left join lateral (
    select profile.full_name
    from public.conversation_members other_member
    left join public.user_profiles profile on profile.user_id = other_member.user_id
    where other_member.conversation_id = c.id
      and other_member.user_id <> (select auth.uid())
    order by other_member.joined_at
    limit 1
  ) other_profile on c.kind = 'direct'
  left join public.user_profiles customer_profile on customer_profile.user_id = c.customer_user_id
  left join lateral (
    select message.body, message.created_at
    from public.messages message
    where message.conversation_id = c.id and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  where pitgarage_private.can_access_conversation(c.id)
  order by c.updated_at desc;
$$;

create or replace function public.send_chat_message(target_conversation uuid, message_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result uuid;
begin
  if (select auth.uid()) is null then raise exception 'authenticated user required'; end if;
  if not pitgarage_private.can_access_conversation(target_conversation) then raise exception 'access denied'; end if;
  if char_length(btrim(message_body)) not between 1 and 4000 then raise exception 'invalid message'; end if;

  insert into public.messages(conversation_id, sender_user_id, body)
  values(target_conversation, (select auth.uid()), btrim(message_body))
  returning id into result;

  update public.conversations set updated_at = now() where id = target_conversation;

  insert into public.notifications(user_id, type, title, message, target, metadata)
  select distinct
    recipient.user_id,
    'chat',
    'Nova mensagem',
    'Você recebeu uma nova mensagem.',
    '/',
    jsonb_build_object('conversation_id', target_conversation)
  from (
    select member.user_id
    from public.conversation_members member
    where member.conversation_id = target_conversation
    union
    select profile.user_id
    from public.user_profiles profile
    join public.conversations conversation
      on conversation.id = target_conversation and conversation.kind in ('team', 'support')
    where profile.is_active and profile.access_level in ('staff', 'admin', 'owner')
    union
    select conversation.customer_user_id
    from public.conversations conversation
    where conversation.id = target_conversation and conversation.kind = 'support'
  ) recipient
  where recipient.user_id is not null and recipient.user_id <> (select auth.uid())
  on conflict (user_id, ((metadata ->> 'conversation_id')))
    where type = 'chat' and read_at is null and metadata ? 'conversation_id'
  do update set
    title = excluded.title,
    message = excluded.message,
    target = excluded.target,
    metadata = excluded.metadata,
    created_at = now();

  return result;
end;
$$;

create or replace function public.mark_chat_read(target_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not pitgarage_private.can_access_conversation(target_conversation) then raise exception 'access denied'; end if;

  insert into public.conversation_members(conversation_id, user_id, last_read_at)
  values(target_conversation, (select auth.uid()), now())
  on conflict(conversation_id, user_id) do update set last_read_at = excluded.last_read_at;

  update public.notifications
  set read_at = now()
  where user_id = (select auth.uid())
    and type = 'chat'
    and read_at is null
    and metadata ->> 'conversation_id' = target_conversation::text;
end;
$$;

revoke execute on function public.list_my_conversations(), public.send_chat_message(uuid, text), public.mark_chat_read(uuid) from public, anon;
grant execute on function public.list_my_conversations(), public.send_chat_message(uuid, text), public.mark_chat_read(uuid) to authenticated;

commit;