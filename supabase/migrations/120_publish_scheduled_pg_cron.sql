-- Migration 120: move scheduled-mix publishing from Vercel Cron to pg_cron
--
-- WHY: vercel.json declared `*/10 * * * * /api/cron/publish-scheduled`. This
-- account is on the Vercel Hobby plan, where cron jobs are limited to running
-- ONCE PER DAY — "cron expressions that would run more frequently will fail
-- during deployment". That single entry was rejecting every deployment, so
-- nothing had reached production since it was added in 1128c01 (2026-07-29).
--
-- Ten-minute publishing granularity is the point of the feature, so dropping to
-- daily is not an option and upgrading the plan should not be a prerequisite for
-- deploying. pg_cron is already the project's scheduler for sub-daily work
-- (008 refreshes mix_scores hourly, 015 runs due Lua agents every minute), so
-- this follows that precedent exactly: the work moves into a SQL function and
-- pg_cron calls it directly. No HTTP hop, no CRON_SECRET, no network dependency.
--
-- /api/cron/publish-scheduled is KEPT as a manual trigger — it is still useful
-- for operators and for local testing — it is simply no longer scheduled by
-- Vercel.
--
-- PREREQUISITE — manual step in the Supabase dashboard (same as 008):
--   1. Open Project Settings → Database → Extensions
--   2. Enable the `pg_cron` extension
--
-- Resolves: Vercel deployment rejection on Hobby cron limits

begin;

-- Guard: bail out clearly if pg_cron is not installed.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception
      'pg_cron extension is not enabled. Enable it in the Supabase dashboard (Database → Extensions) before applying this migration.';
  end if;
end$$;

-- ── The publishing job ──────────────────────────────────────────────────────
-- Mirrors the logic of src/app/api/cron/publish-scheduled/route.ts. A single
-- statement, so a mix cannot be observed half-published, and concurrent runs
-- cannot double-publish: the second run matches no rows because the first
-- already cleared scheduled_at.

create or replace function public.publish_due_mixes()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.mixes
     set visibility   = 'published',
         published    = true,
         published_at = now(),
         scheduled_at = null
   where scheduled_at is not null
     and scheduled_at <= now()
     and (visibility = 'scheduled' or published = false);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.publish_due_mixes() is
  'Publishes mixes whose scheduled_at has passed. Scheduled by pg_cron every ten minutes (migration 120) because Vercel Hobby cron cannot run more than once per day. Idempotent: clearing scheduled_at means a repeat run matches nothing.';

-- Publishing is a server-side scheduled action; no client may invoke it.
revoke all on function public.publish_due_mixes() from anon, authenticated;

-- ── Schedule ────────────────────────────────────────────────────────────────
-- Idempotent: remove any previous schedule before adding the new one.
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'publish_due_mixes_every_10_min';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end$$;

select cron.schedule(
  'publish_due_mixes_every_10_min',
  '*/10 * * * *',
  $cron$ select public.publish_due_mixes(); $cron$
);

commit;

-- Resolves: scheduled publishing no longer depends on a Vercel cron entry that
-- the Hobby plan rejects at deploy time.
