-- Migration 083: Daily platform stats snapshots
--
-- Backs the /api/analytics/daily cron (previously a declared-but-unimplemented
-- stub in vercel.json). Each run snapshots get_hive_stats() into one row per day,
-- giving a time series for growth charts and the finance/analytics dashboards.
-- Written by the service role (cron); publicly readable for aggregate charts.
--
-- Resolves: Engineering Roadmap Phase 1 — implement stub crons

begin;

create table if not exists daily_platform_stats (
  day          date        primary key,
  mixes_total  bigint      not null default 0,
  voices_total bigint      not null default 0,
  plays_total  bigint      not null default 0,
  live_now     bigint      not null default 0,
  created_at   timestamptz not null default now()
);

alter table daily_platform_stats enable row level security;

drop policy if exists "daily_platform_stats_public_read" on daily_platform_stats;
create policy "daily_platform_stats_public_read"
  on daily_platform_stats for select
  using (true);

commit;

-- Resolves: Engineering Roadmap Phase 1 — implement stub crons
