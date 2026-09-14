begin;
create or replace function pitgarage_private.create_structured_backup() returns uuid
language plpgsql security definer set search_path = '' as $$
declare backup_id uuid; snapshot jsonb;
begin
  if not pg_try_advisory_xact_lock(1740293101) then return null; end if;
  if exists(select 1 from pitgarage_private.structured_backups where created_at > clock_timestamp()-interval '72 hours') then return null; end if;
  -- One SQL statement provides one consistent MVCC snapshot of all included tables.
  select jsonb_build_object(
    'format','pitgarage-local-backup','formatVersion',1,'exportedAt',clock_timestamp(),
    'workshop',(select jsonb_build_object('name',w.name,'legalName',w.legal_name,'cnpj',w.cnpj,
      'phone',w.phone,'address',w.address,'postalCode',w.postal_code,'hours',w.hours)
      from public.workshop_settings w),
    'data',jsonb_build_object(
      'customers',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',id,'authUserId',auth_user_id,'name',name,'phone',phone,'email',email,'cpf',cpf,'since',since,'deletedAt',deleted_at
      ))),'[]'::jsonb) from public.customers),
      'vehicles',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',id,'customerId',customer_id,'kind',kind,'brand',brand,'model',model,'year',year,
        'plate',plate,'mileage',mileage,'color',color,'deletedAt',deleted_at
      ))),'[]'::jsonb) from public.vehicles),
      'orders',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id','OS-'||s.order_number,'databaseId',s.id,'customerId',s.customer_id,'vehicleId',s.vehicle_id,
        'status',s.status,'openedAt',s.opened_at,'completedAt',s.completed_at,'entryMileage',s.entry_mileage,
        'complaint',s.complaint,'diagnosis',s.diagnosis,'findings',s.findings,'notes',s.notes,'team',s.team,
        'budget',s.budget,'evidence',s.evidence,'payment',s.payment,'statusHistory',s.status_history,
        'activities',s.activities,'workshopSnapshot',s.workshop_snapshot,'updatedAt',s.updated_at
      ))),'[]'::jsonb) from public.service_orders s)
    ),
    'cloud',jsonb_build_object(
      'version',1,'mediaIncluded',false,'workshopSettingsAvailable',true,
      'tables',jsonb_build_object(
        'customers',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.customers t),
        'vehicles',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.vehicles t),
        'service_orders',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.service_orders t),
        'user_profiles',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.user_profiles t),
        'financial_permissions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.financial_permissions t),
        'order_part_financials',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.order_part_financials t),
        'legacy_financial_budgets',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from pitgarage_private.legacy_financial_budgets t),
        'calendar_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.calendar_events t),
        'notifications',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.notifications t),
        'conversations',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.conversations t),
        'conversation_members',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.conversation_members t),
        'messages',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.messages t),
        'workshop_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.workshop_settings t)
      )
    )
  ) into snapshot;
  insert into pitgarage_private.structured_backups(payload) values(snapshot) returning id into backup_id;
  return backup_id;
end $$;
revoke all on function pitgarage_private.create_structured_backup() from public,anon,authenticated;
commit;