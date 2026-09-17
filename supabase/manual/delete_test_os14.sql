-- MANUAL ONLY: PitGarage project vzvwprzmlhvfehwykstx, administrative SQL connection.
-- Run the complete file once. Any error requires ROLLBACK; do not run fragments.
-- No Storage objects are deleted by SQL. Save the final result for Storage API cleanup.
-- This is a one-off test-data cleanup, not a migration or a change to normal deletion rules.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local row_security = off;

-- Serialize writes while the normal movement guard is temporarily disabled.
-- Transactional DDL restores the guard even if any subsequent statement fails.
lock table public.service_orders, public.order_part_financials,
  public.calendar_events, public.quotes, public.notifications,
  pitgarage_private.legacy_financial_budgets in access exclusive mode;

create temporary table os14_storage_manifest (
  order_id uuid, bucket_id text, path text, action text
) on commit preserve rows;

do $cleanup$
declare
  target public.service_orders%rowtype;
  matches bigint;
  affected bigint;
  sequence_value bigint;
  sequence_called boolean;
  guard_state "char";
  dependency record;
begin
  select count(*) into matches from public.service_orders where order_number = 14;
  if matches <> 1 then
    raise exception 'ABORT: expected exactly one OS with order_number=14, found %', matches;
  end if;
  select * into strict target from public.service_orders where order_number = 14;

  -- Never setval/restart/advance the sequence. Abort if normal generation could reuse 14.
  select last_value, is_called into sequence_value, sequence_called
    from public.service_order_number_seq;
  if sequence_value < 14 or (sequence_value = 14 and not sequence_called)
    or not exists (select 1 from pg_catalog.pg_sequence
      where seqrelid = 'public.service_order_number_seq'::regclass
        and seqincrement = 1 and not seqcycle and seqcache = 1)
    or pg_get_expr((select adbin from pg_catalog.pg_attrdef
      where adrelid = 'public.service_orders'::regclass and adnum = (
        select attnum from pg_catalog.pg_attribute
        where attrelid = 'public.service_orders'::regclass and attname = 'order_number')),
      'public.service_orders'::regclass) is distinct from
      'nextval(''service_order_number_seq''::regclass)'
  then
    raise exception 'ABORT: unexpected numbering configuration; sequence was not changed';
  end if;

  -- Refuse unknown FK dependencies, including cascades on rows removed below.
  for dependency in
    select c.*, a.attname as source_column, b.attname as target_column
    from pg_catalog.pg_constraint c
    left join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    left join pg_catalog.pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
    where c.contype='f' and c.confrelid in (
      'public.service_orders'::regclass, 'public.order_part_financials'::regclass,
      'public.notifications'::regclass, 'pitgarage_private.legacy_financial_budgets'::regclass)
  loop
    if not (dependency.confrelid='public.service_orders'::regclass
      and cardinality(dependency.conkey)=1 and cardinality(dependency.confkey)=1
      and dependency.target_column='id'
      and ((dependency.conrelid='public.order_part_financials'::regclass and dependency.source_column='order_id')
        or (dependency.conrelid='public.calendar_events'::regclass and dependency.source_column='service_order_id')
        or (dependency.conrelid='public.quotes'::regclass and dependency.source_column='service_order_id')))
    then
      raise exception 'ABORT: unreviewed FK % on %', dependency.conname, dependency.conrelid::regclass;
    end if;
  end loop;

  -- Do not silently execute newly introduced triggers/rules during this exceptional cleanup.
  if exists (select 1 from pg_catalog.pg_rewrite where rulename <> '_RETURN'
    and ev_class in ('public.service_orders'::regclass, 'public.order_part_financials'::regclass,
      'public.notifications'::regclass, 'public.calendar_events'::regclass,
      'public.quotes'::regclass, 'pitgarage_private.legacy_financial_budgets'::regclass))
  then raise exception 'ABORT: unreviewed rewrite rule'; end if;
  if exists (select 1 from pg_catalog.pg_trigger t where not t.tgisinternal and t.tgenabled <> 'D'
    and ((t.tgrelid in ('public.service_orders'::regclass, 'public.order_part_financials'::regclass,
      'public.notifications'::regclass, 'pitgarage_private.legacy_financial_budgets'::regclass)
      and (t.tgtype::int & 8) <> 0)
      or (t.tgrelid in ('public.calendar_events'::regclass, 'public.quotes'::regclass)
      and (t.tgtype::int & 16) <> 0))
    and not (t.tgrelid='public.service_orders'::regclass and t.tgname='guard_order_delete'
      and t.tgfoid='pitgarage_private.guard_order_delete()'::regprocedure)
    and not (t.tgrelid='public.quotes'::regclass and t.tgname='check_quote_vehicle_snapshot'
      and t.tgfoid='pitgarage_private.check_quote_vehicle_snapshot()'::regprocedure))
  then raise exception 'ABORT: unreviewed trigger'; end if;
  select tgenabled into guard_state from pg_catalog.pg_trigger
    where tgrelid='public.service_orders'::regclass and tgname='guard_order_delete';
  if guard_state is distinct from 'O'::"char" then
    raise exception 'ABORT: normal deletion guard missing or unexpectedly configured';
  end if;

  -- Capture paths before removing evidence metadata. Never delete storage.objects directly.
  insert into os14_storage_manifest
    select distinct target.id, 'os-evidence', e->>'path', 'REVIEW'
    from jsonb_array_elements(coalesce(target.evidence, '[]'::jsonb)) e
    where nullif(e->>'path','') is not null;
  if to_regclass('storage.objects') is not null then
    execute 'insert into os14_storage_manifest
      select $1, bucket_id, name, ''REVIEW'' from storage.objects
      where bucket_id=''os-evidence'' and split_part(name,''/'',1)=$1::text
      and not exists (select 1 from os14_storage_manifest m where m.path=name)'
      using target.id;
  end if;
  update os14_storage_manifest m set action = case
    when split_part(m.path,'/',1) <> target.id::text then 'PRESERVE: path outside OS folder'
    when exists (select 1 from public.service_orders s,
      lateral jsonb_array_elements(coalesce(s.evidence,'[]'::jsonb)) e
      where s.id <> target.id and e->>'path'=m.path) then 'PRESERVE: referenced by another OS'
    else 'REMOVE VIA STORAGE API ONLY AFTER SUCCESSFUL COMMIT' end;

  -- Independent records survive; their original status and content are retained.
  update public.calendar_events set service_order_id=null, updated_at=clock_timestamp()
    where service_order_id=target.id;
  update public.quotes set service_order_id=null, updated_at=clock_timestamp()
    where service_order_id=target.id;
  -- Quote item costs stay with their preserved quote.
  delete from public.order_part_financials where order_id=target.id;
  delete from pitgarage_private.legacy_financial_budgets where order_id=target.id;
  delete from public.notifications where metadata->>'service_order_id'=target.id::text;

  alter table public.service_orders disable trigger guard_order_delete;
  -- Removes this OS's embedded budget, payment/receipts, discount, activities and evidence metadata.
  delete from public.service_orders where id=target.id and order_number=14;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'ABORT: expected exactly one deleted OS'; end if;
  alter table public.service_orders enable trigger guard_order_delete;

  if exists (select 1 from public.service_orders where order_number=14)
    or exists (select 1 from public.calendar_events where service_order_id=target.id)
    or exists (select 1 from public.quotes where service_order_id=target.id)
    or exists (select 1 from public.order_part_financials where order_id=target.id)
    or exists (select 1 from pitgarage_private.legacy_financial_budgets where order_id=target.id)
    or exists (select 1 from public.notifications where metadata->>'service_order_id'=target.id::text)
  then raise exception 'ABORT: OS or dependencies remain'; end if;
  if (select last_value from public.service_order_number_seq) <> sequence_value
    or (select is_called from public.service_order_number_seq) <> sequence_called
  then raise exception 'ABORT: sequence changed concurrently; no sequence reset was attempted'; end if;
  raise notice 'OS 14 deleted: %. Customer %, vehicle % preserved. Storage files: %.',
    target.id, target.customer_id, target.vehicle_id, (select count(*) from os14_storage_manifest);
end;
$cleanup$;
commit;

-- Returned only after the cleanup commits. Empty result means no known Storage paths.
select order_id, bucket_id, path, action from os14_storage_manifest order by bucket_id, path;
drop table os14_storage_manifest;
