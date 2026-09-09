create or replace function pitgarage_private.can_view_order_evidence(target_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_order is null then false
    when pitgarage_private.is_team_member() then exists (
      select 1 from public.service_orders as so where so.id = target_order
    )
    else exists (
      select 1
      from public.service_orders as so
      join public.customers as c on c.id = so.customer_id
      where so.id = target_order
        and so.deleted_at is null
        and c.deleted_at is null
        and c.auth_user_id = (select auth.uid())
    )
  end;
$$;

revoke all on function pitgarage_private.can_view_order_evidence(uuid) from public;
grant execute on function pitgarage_private.can_view_order_evidence(uuid) to authenticated;

create or replace function pitgarage_private.evidence_order_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_folder text := (storage.foldername(object_name))[1];
begin
  return first_folder::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function pitgarage_private.evidence_order_id(text) from public;
grant execute on function pitgarage_private.evidence_order_id(text) to authenticated;

drop policy if exists "os_evidence_team_insert" on storage.objects;
drop policy if exists "os_evidence_team_update" on storage.objects;
drop policy if exists "os_evidence_team_delete" on storage.objects;
drop policy if exists "os_evidence_allowed_select" on storage.objects;

create policy "os_evidence_allowed_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'os-evidence'
  and pitgarage_private.can_view_order_evidence(pitgarage_private.evidence_order_id(name))
);

create policy "os_evidence_team_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'os-evidence'
  and pitgarage_private.is_team_member()
  and pitgarage_private.can_view_order_evidence(pitgarage_private.evidence_order_id(name))
);

create policy "os_evidence_team_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'os-evidence'
  and pitgarage_private.is_team_member()
  and pitgarage_private.can_view_order_evidence(pitgarage_private.evidence_order_id(name))
)
with check (
  bucket_id = 'os-evidence'
  and pitgarage_private.is_team_member()
  and pitgarage_private.can_view_order_evidence(pitgarage_private.evidence_order_id(name))
);

create policy "os_evidence_team_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'os-evidence'
  and pitgarage_private.is_team_member()
  and pitgarage_private.can_view_order_evidence(pitgarage_private.evidence_order_id(name))
);