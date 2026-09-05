create or replace function public.list_assignable_members()
returns table(user_id uuid, full_name text, operational_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.full_name, p.operational_role
  from public.user_profiles p
  where (select pitgarage_private.is_team_member())
    and p.is_active
    and p.access_level in ('staff', 'admin', 'owner')
    and coalesce(btrim(p.full_name), '') <> ''
  order by p.full_name;
$$;

revoke execute on function public.list_assignable_members() from public, anon;
grant execute on function public.list_assignable_members() to authenticated;