-- Migration 107: populate profile_analytics_daily from analytics_events
-- Enables per-creator dashboards and monthly recap emails.

begin;

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
    count(*) filter (where event_type = 'profile_view'),
    count(*) filter (where event_type = 'play'),
    count(*) filter (where event_type = 'like'),
    count(*) filter (where event_type = 'comment'),
    count(*) filter (where event_type = 'share'),
    count(*) filter (where event_type = 'follow')
  from public.analytics_events
  where created_at::date = p_day
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
