-- Extensions the rest of the chain assumes are already present.
--
-- Migrations 008 and 015 hard-fail without pg_cron, by design — they expect an
-- operator to have enabled it in the Supabase dashboard first. That guard is
-- reasonable for production but made the chain unbuildable anywhere else, so a
-- clean checkout could never stand up a database to test against.
--
-- Sorts before 001 and is idempotent, so it is a no-op on any environment where
-- the extension was already enabled by hand.
create extension if not exists pg_cron;
