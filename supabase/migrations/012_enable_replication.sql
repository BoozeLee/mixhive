-- Migration 012: enable Supabase realtime replication on engagement tables
--
-- Phase 2.5 of the 5-star roadmap adds client subscriptions for:
--   - new comments on the mix you're looking at
--   - like-count changes on the mix you're looking at
--   - new feed_events landing in your following feed
--
-- The Supabase realtime broker only emits postgres_changes for tables in
-- the `supabase_realtime` publication. Toggling tables via the Supabase
-- dashboard works but isn't reproducible, so we do it here.
--
-- Resolves: Phase 2.5 in plans/below-is-a-super-engineered-precious-babbage.md

begin;

do $$
declare
  pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if not pub_exists then
    -- Brand-new Supabase projects always have this publication, but be
    -- defensive in case someone restored a database that lacked it.
    create publication supabase_realtime;
  end if;
end$$;

-- alter publication ... add table is not idempotent across versions of
-- Postgres; the safe pattern is to attempt the add and swallow the
-- "duplicate" error if the table is already in the publication.
do $$
begin
  begin
    alter publication supabase_realtime add table public.comments;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.likes;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.feed_events;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end$$;

commit;
