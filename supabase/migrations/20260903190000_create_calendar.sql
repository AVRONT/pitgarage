begin;

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  category text not null default 'other' check (category in ('appointment', 'delivery', 'return', 'other')),
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  service_order_id uuid references public.service_orders(id) on delete set null,
  visible_to_customer boolean not null default false,
  created_by uuid references public.user_profiles(user_id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index calendar_events_starts_at_idx on public.calendar_events(starts_at) where deleted_at is null;
create index calendar_events_customer_idx on public.calendar_events(customer_id) where deleted_at is null;

alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from public, anon, authenticated;
grant select on public.calendar_events to authenticated;

create policy calendar_events_team_select on public.calendar_events for select to authenticated
  using ((select pitgarage_private.is_team_member()));

create function public.list_calendar_events(range_start timestamptz, range_end timestamptz)
returns setof public.calendar_events language sql stable security definer set search_path = '' as $$
  select e.* from public.calendar_events e where (select pitgarage_private.is_team_member())
    and e.deleted_at is null and e.starts_at >= range_start and e.starts_at < range_end
  order by e.starts_at;
$$;
create function public.save_calendar_event(event_id uuid, event_title text, event_starts_at timestamptz,
  event_ends_at timestamptz, event_notes text, event_category text, related_customer uuid,
  related_vehicle uuid, related_service_order uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not (select pitgarage_private.is_team_member()) then raise exception 'team access required'; end if;
  if event_id is null then
    insert into public.calendar_events(title,starts_at,ends_at,notes,category,customer_id,vehicle_id,service_order_id,created_by)
    values(event_title,event_starts_at,event_ends_at,event_notes,event_category,related_customer,related_vehicle,related_service_order,(select auth.uid())) returning id into result;
  else
    update public.calendar_events set title=event_title,starts_at=event_starts_at,ends_at=event_ends_at,
      notes=event_notes,category=event_category,customer_id=related_customer,vehicle_id=related_vehicle,
      service_order_id=related_service_order,updated_at=now() where id=event_id and deleted_at is null returning id into result;
  end if;
  if result is null then raise exception 'event not found'; end if;
  return result;
end;
$$;
create function public.cancel_calendar_event(event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select pitgarage_private.is_team_member()) then raise exception 'team access required'; end if;
  update public.calendar_events set deleted_at=now(),updated_at=now() where id=event_id and deleted_at is null;
end;
$$;
revoke execute on function public.list_calendar_events(timestamptz,timestamptz), public.save_calendar_event(uuid,text,timestamptz,timestamptz,text,text,uuid,uuid,uuid), public.cancel_calendar_event(uuid) from public, anon;
grant execute on function public.list_calendar_events(timestamptz,timestamptz), public.save_calendar_event(uuid,text,timestamptz,timestamptz,text,text,uuid,uuid,uuid), public.cancel_calendar_event(uuid) to authenticated;

commit;
