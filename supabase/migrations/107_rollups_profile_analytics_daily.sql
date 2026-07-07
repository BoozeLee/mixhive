-- Migration 107: populate profile_analytics_daily from analytics_events
-- Enables per-creator dashboards and monthly recap emails.

begin;

-- App code emits namespaced event types (mix_play, profile_follow, etc.).
-- Drop the legacy restrictive check so real events can be stored.
alter table public.analytics_events
  drop constraint if exists analytics_events_event_type_check;

-- Index optimized for date-first aggregation across profiles.
create index if not exists idx_analytics_events_rollups
  on public.analytics_events(created_at, event_type, profile_id);

create or replace function public.rollup_profile_analytics(p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_analytics_daily (
    profile_id, day, profile_views, plays, likes, comments, shares, follows
  )
  select
    profile_id,
    p_day,
    (count(*) filter (where event_type = 'profile_view'))::int,
    (count(*) filter (where event_type = 'mix_play'))::int,
    (count(*) filter (where event_type = 'mix_like'))::int,
    (count(*) filter (where event_type = 'comment_create'))::int,
    (count(*) filter (where event_type = 'mix_share'))::int,
    (count(*) filter (where event_type = 'profile_follow'))::int
  from public.analytics_events
  where created_at >= p_day
    and created_at < p_day + interval '1 day'
    and profile_id is not null
  group by profile_id
  on conflict (profile_id, day) do update set
    profile_views = excluded.profile_views,
    plays = excluded.plays,
    likes = excluded.likes,
    comments = excluded.comments,
    shares = excluded.shares,
    follows = excluded.follows,
    updated_at = now();
end;
$$;

revoke execute on function public.rollup_profile_analytics(date) from public, anon;
grant execute on function public.rollup_profile_analytics(date) to service_role;

commit;
