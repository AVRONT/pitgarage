-- RUN MANUALLY ONLY AFTER:
-- 1. the proposal migration has been reviewed and applied;
-- 2. Salomao's real Supabase Auth account has been created;
-- 3. the real auth.users UUID, name and operational role have been confirmed.
--
-- Replace every placeholder below. Do not use an email address here and do not
-- add an automatic "first user becomes owner" rule.

begin;

select pitgarage_private.bootstrap_first_owner(
  '<REAL_AUTH_USER_UUID>'::uuid,
  '<CONFIRMED_FULL_NAME>',
  '<CONFIRMED_OPERATIONAL_ROLE>'
);

commit;
