-- Extensions the rest of the chain assumes are already present.
--
-- Migrations 008 and 015 hard-fail without pg_cron, by design — they expect an
-- operator to have enabled it in the Supabase dashboard first. That guard is
-- reasonable for production but made the chain unbuildable anywhere else, so a
-- clean checkout could never stand up a database to test against.
--
-- Sorts before 001 and is idempotent, so it is a no-op on any environment where
-- the extension was already enabled by hand.
--
-- The exception handler is for production specifically: CREATE EXTENSION needs
-- privileges this role may not have, and where pg_cron is already enabled the
-- statement has nothing to do anyway. Failing an entire push over a no-op would
-- be the worst outcome, so a refusal degrades to a notice.
--
-- This does not weaken the original guard. If pg_cron is genuinely absent and
-- cannot be created, 008 and 015 still hard-fail with their operator-facing
-- message telling you to enable it in the dashboard.
do $$
begin
  create extension if not exists pg_cron;
exception when insufficient_privilege or feature_not_supported then
  raise notice 'pg_cron not created (%); 008/015 will report if it is required.', sqlerrm;
end$$;
