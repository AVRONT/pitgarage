create extension if not exists pg_cron;
select cron.schedule(
  'pitgarage-structured-backup',
  '0 3 * * *',
  $job$select pitgarage_private.create_structured_backup();$job$
);