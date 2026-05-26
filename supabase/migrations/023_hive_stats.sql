-- Migration 023: get_hive_stats() — single aggregate read for landing page.
--
-- Landing.tsx renders four stat cards: total mixes, unique DJs (=voices),
-- total plays, and a "live now" count (currently ~0 until live-stream feed
-- events exist). Wrapping it in one RPC means the landing does one round-
-- trip rather than four count(*) queries. SECURITY DEFINER so anonymous
-- visitors can read aggregates without RLS poking through each table.
--
-- Idempotent: drop-and-recreate the function on every apply. No schema
-- changes to existing tables.
--
-- Resolves: Landing stats strip in wild-hopping-scone plan.

drop function if exists public.get_hive_stats();

create or replace function public.get_hive_stats()
returns table (
  mixes_total  bigint,
  voices_total bigint,
  plays_total  bigint,
  live_now     bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::bigint from public.mixes where published = true)              as mixes_total,
    (select count(distinct dj_id)::bigint from public.mixes where published = true) as voices_total,
    (select coalesce(sum(play_count), 0)::bigint from public.mixes)                 as plays_total,
    (
      select count(*)::bigint
      from public.feed_events
      where type = 'live'
        and created_at > now() - interval '5 minutes'
    ) as live_now;
$$;

-- Anyone (anon role included) can call this — the function only returns
-- whole-platform aggregates, no row-level data.
grant execute on function public.get_hive_stats() to anon, authenticated;
