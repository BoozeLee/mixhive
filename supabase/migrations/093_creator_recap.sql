-- Migration 093: Creator "Wrapped" recap RPC
--
-- WHY: Phase 11 (Creator Studio) needs a monthly recap of a creator's own stats.
-- A SECURITY DEFINER function scoped to auth.uid() aggregates the caller's
-- profile_analytics_daily + top mix without exposing other creators' analytics
-- and without loosening RLS on profile_analytics_daily.
--
-- Resolves: Phase 11 (Creator Studio) — card 9969627090

begin;

create or replace function public.get_creator_recap(p_days int default 30)
returns jsonb
language sql stable security definer set search_path = public as $$
  with me as (select (select auth.uid()) as uid),
  agg as (
    select
      coalesce(sum(pad.plays), 0)         as plays,
      coalesce(sum(pad.likes), 0)         as likes,
      coalesce(sum(pad.comments), 0)      as comments,
      coalesce(sum(pad.follows), 0)       as follows,
      coalesce(sum(pad.profile_views), 0) as profile_views,
      count(*)                            as active_days,
      coalesce(max(pad.plays), 0)         as best_day_plays
    from public.profile_analytics_daily pad, me
    where pad.profile_id = me.uid
      and pad.day >= (current_date - greatest(p_days, 1))
  ),
  top as (
    select m.id, m.title, coalesce(m.play_count, 0) as play_count, coalesce(m.like_count, 0) as like_count
    from public.mixes m, me
    where m.dj_id = me.uid
    order by coalesce(m.play_count, 0) desc
    limit 1
  )
  select jsonb_build_object(
    'days', greatest(p_days, 1),
    'totals', coalesce((select to_jsonb(agg) from agg), '{}'::jsonb),
    'top_mix', (select to_jsonb(top) from top)
  );
$$;

revoke execute on function public.get_creator_recap(int) from public, anon;
grant execute on function public.get_creator_recap(int) to authenticated;

commit;

-- Resolves: Phase 11 (Creator Studio) — card 9969627090
