-- Migration 008: schedule hourly refresh of mix_scores via pg_cron
--
-- The trending feed scoring lives in the `mix_scores` materialized table
-- and is updated incrementally by triggers on plays/likes. Over time the
-- 7-day rolling window drifts because scores are only recomputed when a
-- new play/like fires the trigger — mixes whose activity has decayed do
-- not get re-scored. A scheduled full refresh keeps the trending feed
-- honest.
--
-- PREREQUISITE — manual step in the Supabase dashboard:
--   1. Open Project Settings → Database → Extensions
--   2. Enable the `pg_cron` extension
--   3. Then apply this migration
--
-- This migration will FAIL with "extension pg_cron does not exist" until
-- the extension is enabled. That is intentional — the operator must opt in.
--
-- Resolves: #3

begin;

-- Guard: bail out clearly if pg_cron is not installed.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception
      'pg_cron extension is not enabled. Enable it in the Supabase dashboard (Database → Extensions) before applying this migration.';
  end if;
end$$;

-- Idempotent: remove any previous schedule before adding the new one.
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'refresh_mix_scores_hourly';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end$$;

-- Schedule: run refresh_mix_scores() every hour at minute 17 to avoid
-- contention with services that hit the top of the hour.
select cron.schedule(
  'refresh_mix_scores_hourly',
  '17 * * * *',
  $cron$ select public.refresh_mix_scores(); $cron$
);

commit;
