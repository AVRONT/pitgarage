-- OPTIONAL REMOTE STEP: review and run only after migrations and explicit approval.
-- Requires pg_cron enabled by the platform. Schedule in the database-admin context.
-- UTC daily check; successful snapshots are separated by at least 72 hours.
select cron.schedule(
  'pitgarage-structured-backup',
  '0 3 * * *',
  $job$select pitgarage_private.create_structured_backup();$job$
);
-- Initial execution / verification (admin context):
-- select pitgarage_private.create_structured_backup();
-- select id, created_at, pg_column_size(payload) from pitgarage_private.structured_backups order by created_at desc;
-- select status, start_time, return_message from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname='pitgarage-structured-backup') order by start_time desc limit 10;
-- Export payload as JSON through trusted admin tooling. Do not expose the table through public API.

