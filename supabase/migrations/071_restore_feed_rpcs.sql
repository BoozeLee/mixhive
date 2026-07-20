-- Migration 071: Restore missing feed-algorithm RPCs and mix_scores table
--
-- Migrations 004 and 023 were marked as applied via `repair --status applied`
-- without executing their SQL on the production database. This migration
-- restores everything they would have created, adapted to the actual production
-- mixes table schema (no `status` or `audio_quality` column — uses `upload_status`).
--
--   1. mix_scores table (trending score cache)
--   2. refresh_mix_scores() — full recompute, called by pg_cron
--   3. handle_mix_publish_feed() — fan-out trigger on mix publish
--   4. get_feed_cursor()     — following-feed RPC
--   5. get_trending_cursor() — trending-feed RPC (reads mix_scores)
--   6. get_latest_cursor()   — latest-feed RPC
--   7. get_fans_also_liked() — recommendation RPC on mix detail
--   8. get_discovery()       — discovery-feed RPC
--   9. update_mix_score_on_play / on_like / on_unlike — incremental score triggers
--  10. get_hive_stats()      — single-roundtrip landing page aggregate RPC
--
-- Resolves: feed 404 RPCs in production (browser smoke detection 2026-06-01)

begin;

-- Earlier migrations defined several of these functions with different OUT row
-- types, and `create or replace` cannot change a function's return type
-- (42P13). Drop every existing overload by signature first; the definitions
-- below are authoritative.
do $$
declare
  r record;
  fn text;
begin
  foreach fn in array array[
    'get_discovery',
    'get_fans_also_liked',
    'get_feed_cursor',
    'get_hive_stats',
    'get_latest_cursor',
    'get_trending_cursor',
    'handle_mix_publish_feed',
    'refresh_mix_scores',
    'update_mix_score_on_like',
    'update_mix_score_on_play',
    'update_mix_score_on_unlike'
  ] loop
    for r in
      select oid::regprocedure as sig
      from pg_proc
      where proname = fn
        and pronamespace = 'public'::regnamespace
    loop
      execute format('drop function if exists %s cascade', r.sig);
    end loop;
  end loop;
end$$;

-- ── 1. mix_scores ────────────────────────────────────────────────────────────

create table if not exists public.mix_scores (
  mix_id       uuid    primary key references public.mixes(id) on delete cascade,
  score        float   not null default 0,
  weekly_plays int     not null default 0,
  weekly_likes int     not null default 0,
  updated_at   timestamptz default now()
);

-- ── 2. refresh_mix_scores ────────────────────────────────────────────────────

create or replace function public.refresh_mix_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.mix_scores;
  insert into public.mix_scores (mix_id, score, weekly_plays, weekly_likes, updated_at)
  select
    m.id,
    (count(ph.id) * 1.0 + count(distinct l.user_id) * 3.0) as score,
    count(ph.id)::int                                        as weekly_plays,
    count(distinct l.user_id)::int                           as weekly_likes,
    now()
  from public.mixes m
  left join public.play_history ph on ph.mix_id = m.id
    and ph.played_at > now() - interval '7 days'
  left join public.likes l on l.mix_id = m.id
    and l.created_at > now() - interval '7 days'
  where m.published = true
  group by m.id;
end;
$$;

-- ── 3. handle_mix_publish_feed (fan-out trigger) ──────────────────────────────

create or replace function public.handle_mix_publish_feed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.feed_events (actor_id, type, mix_id, target_id)
  select new.dj_id, 'mix_upload', new.id, following_id
  from public.follows
  where follower_id = new.dj_id;
  return new;
end;
$$;

drop trigger if exists on_mix_publish_feed on public.mixes;
create trigger on_mix_publish_feed
  after insert on public.mixes
  for each row
  when (new.published = true)
  execute function public.handle_mix_publish_feed();

-- ── 4. get_feed_cursor ────────────────────────────────────────────────────────

create or replace function public.get_feed_cursor(
  p_user_id            uuid,
  p_limit              int         default 20,
  p_cursor_created_at  timestamptz default null,
  p_cursor_id          uuid        default null
)
returns table (
  id               uuid,
  title            text,
  artwork_url      text,
  audio_url        text,
  duration_seconds int,
  play_count       int,
  like_count       int,
  comment_count    int,
  genre_name       text,
  tags             text[],
  waveform_url     text,
  upload_status    text,
  created_at       timestamptz,
  dj_id            uuid,
  dj_username      text,
  dj_display_name  text,
  dj_avatar_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.upload_status,
    fe.created_at as created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url
  from public.feed_events fe
  join public.mixes m on m.id = fe.mix_id
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where fe.target_id = p_user_id
    and fe.type = 'mix_upload'
    and (p_cursor_created_at is null or fe.created_at < p_cursor_created_at)
  order by fe.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_feed_cursor(uuid, int, timestamptz, uuid) to anon, authenticated;

-- ── 5. get_trending_cursor ────────────────────────────────────────────────────

create or replace function public.get_trending_cursor(
  p_limit        int   default 20,
  p_cursor_score float default null,
  p_cursor_id    uuid  default null
)
returns table (
  id               uuid,
  title            text,
  artwork_url      text,
  audio_url        text,
  duration_seconds int,
  play_count       int,
  like_count       int,
  comment_count    int,
  genre_name       text,
  tags             text[],
  waveform_url     text,
  upload_status    text,
  weekly_plays     int,
  score            float,
  created_at       timestamptz,
  dj_id            uuid,
  dj_username      text,
  dj_display_name  text,
  dj_avatar_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.upload_status,
    ms.weekly_plays, ms.score, m.created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url
  from public.mix_scores ms
  join public.mixes m on m.id = ms.mix_id
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where (p_cursor_score is null
    or ms.score < p_cursor_score
    or (ms.score = p_cursor_score and m.id > p_cursor_id))
  order by ms.score desc, m.id asc
  limit p_limit;
$$;

grant execute on function public.get_trending_cursor(int, float, uuid) to anon, authenticated;

-- ── 6. get_latest_cursor ──────────────────────────────────────────────────────

create or replace function public.get_latest_cursor(
  p_limit              int         default 20,
  p_cursor_created_at  timestamptz default null,
  p_cursor_id          uuid        default null
)
returns table (
  id               uuid,
  title            text,
  artwork_url      text,
  audio_url        text,
  duration_seconds int,
  play_count       int,
  like_count       int,
  comment_count    int,
  genre_name       text,
  tags             text[],
  waveform_url     text,
  upload_status    text,
  created_at       timestamptz,
  dj_id            uuid,
  dj_username      text,
  dj_display_name  text,
  dj_avatar_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.upload_status,
    m.created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url
  from public.mixes m
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where m.published = true
    and (p_cursor_created_at is null or m.created_at < p_cursor_created_at)
  order by m.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_latest_cursor(int, timestamptz, uuid) to anon, authenticated;

-- ── 7. get_fans_also_liked ────────────────────────────────────────────────────

create or replace function public.get_fans_also_liked(
  p_mix_id uuid,
  p_limit  int default 5
)
returns table (
  id               uuid,
  title            text,
  artwork_url      text,
  audio_url        text,
  duration_seconds int,
  play_count       int,
  like_count       int,
  genre_name       text,
  created_at       timestamptz,
  dj_id            uuid,
  dj_username      text,
  dj_display_name  text,
  dj_avatar_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count,
    g.name as genre_name, m.created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url
  from (
    select l2.mix_id, count(*) as common_likers
    from public.likes l1
    join public.likes l2 on l1.user_id = l2.user_id
      and l2.mix_id != p_mix_id
    where l1.mix_id = p_mix_id
    group by l2.mix_id
    order by common_likers desc
    limit p_limit
  ) recs
  join public.mixes m on m.id = recs.mix_id
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where m.published = true;
$$;

grant execute on function public.get_fans_also_liked(uuid, int) to anon, authenticated;

-- ── 8. get_discovery ─────────────────────────────────────────────────────────

create or replace function public.get_discovery(
  p_user_id      uuid,
  p_limit        int   default 20,
  p_cursor_score float default null
)
returns table (
  id               uuid,
  title            text,
  artwork_url      text,
  audio_url        text,
  duration_seconds int,
  play_count       int,
  like_count       int,
  comment_count    int,
  genre_name       text,
  tags             text[],
  waveform_url     text,
  upload_status    text,
  weekly_plays     int,
  score            float,
  created_at       timestamptz,
  dj_id            uuid,
  dj_username      text,
  dj_display_name  text,
  dj_avatar_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.upload_status,
    ms.weekly_plays, ms.score, m.created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url
  from public.mix_scores ms
  join public.mixes m on m.id = ms.mix_id
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where m.dj_id not in (
    select following_id from public.follows where follower_id = p_user_id
  )
  and m.id not in (
    select mix_id from public.play_history where user_id = p_user_id
  )
  and (p_cursor_score is null or ms.score < p_cursor_score)
  order by ms.score desc
  limit p_limit;
$$;

grant execute on function public.get_discovery(uuid, int, float) to authenticated;

-- ── 9. Incremental score triggers ────────────────────────────────────────────

create or replace function public.update_mix_score_on_play()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mix_scores (mix_id, score, weekly_plays, weekly_likes, updated_at)
  values (new.mix_id, 1.0, 1, 0, now())
  on conflict (mix_id) do update set
    score        = public.mix_scores.score + 1.0,
    weekly_plays = public.mix_scores.weekly_plays + 1,
    updated_at   = now();
  return new;
end;
$$;

drop trigger if exists on_play_for_scores on public.play_history;
create trigger on_play_for_scores
  after insert on public.play_history
  for each row
  execute function public.update_mix_score_on_play();

create or replace function public.update_mix_score_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mix_scores (mix_id, score, weekly_plays, weekly_likes, updated_at)
  values (new.mix_id, 3.0, 0, 1, now())
  on conflict (mix_id) do update set
    score        = public.mix_scores.score + 3.0,
    weekly_likes = public.mix_scores.weekly_likes + 1,
    updated_at   = now();
  return new;
end;
$$;

drop trigger if exists on_like_for_scores on public.likes;
create trigger on_like_for_scores
  after insert on public.likes
  for each row
  execute function public.update_mix_score_on_like();

create or replace function public.update_mix_score_on_unlike()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mix_scores
  set score        = greatest(score - 3.0, 0),
      weekly_likes = greatest(weekly_likes - 1, 0),
      updated_at   = now()
  where mix_id = old.mix_id;
  return old;
end;
$$;

drop trigger if exists on_unlike_for_scores on public.likes;
create trigger on_unlike_for_scores
  after delete on public.likes
  for each row
  execute function public.update_mix_score_on_unlike();

-- ── 10. get_hive_stats (landing page aggregates) ─────────────────────────────

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
    (select count(*)::bigint from public.mixes where published = true)               as mixes_total,
    (select count(distinct dj_id)::bigint from public.mixes where published = true)  as voices_total,
    (select coalesce(sum(play_count), 0)::bigint from public.mixes)                  as plays_total,
    (
      select count(*)::bigint
      from public.feed_events
      where type = 'live'
        and created_at > now() - interval '5 minutes'
    ) as live_now;
$$;

grant execute on function public.get_hive_stats() to anon, authenticated;

-- Seed mix_scores from existing play/like history
select public.refresh_mix_scores();

-- Resolves: missing feed RPCs from migrations 004 and 023 (repaired without executing)

commit;
