-- Mix Hive v4 - Feed Algorithm Redesign
-- Run after 003_waveform_pipeline.sql

-- Requires pg_cron extension (enable in Supabase dashboard)
-- create extension if not exists pg_cron with schema pg_catalog;

-- ===== 6.1: MATERIALIZED MIX SCORES =====

create table if not exists public.mix_scores (
  mix_id uuid primary key references public.mixes(id) on delete cascade,
  score float not null default 0,
  weekly_plays int not null default 0,
  weekly_likes int not null default 0,
  updated_at timestamptz default now()
);

-- Refresh function: computes trending score from recent plays + likes
create or replace function public.refresh_mix_scores()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.mix_scores;

  insert into public.mix_scores (mix_id, score, weekly_plays, weekly_likes, updated_at)
  select
    m.id,
    (
      count(ph.id) * 1.0 +
      count(distinct l.user_id) * 3.0
    ) as score,
    count(ph.id)::int as weekly_plays,
    count(distinct l.user_id)::int as weekly_likes,
    now()
  from public.mixes m
  left join public.play_history ph on ph.mix_id = m.id
    and ph.played_at > now() - interval '7 days'
  left join public.likes l on l.mix_id = m.id
    and l.created_at > now() - interval '7 days'
  where m.published = true
    and m.status = 'ready'
  group by m.id;
end;
$$;

-- Schedule hourly refresh via pg_cron
-- Uncomment after enabling pg_cron extension:
-- select cron.schedule('refresh-mix-scores', '0 * * * *', 'select refresh_mix_scores();');

-- ===== 6.2: FAN-OUT ON MIX PUBLISH =====

-- Trigger: when a mix is published, insert feed_events for all followers
create or replace function public.handle_mix_publish_feed()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.feed_events (actor_id, type, mix_id, target_id)
  select new.dj_id, 'mix_upload', new.id, following_id
  from public.follows
  where follower_id = new.dj_id;
  return new;
end;
$$;

create trigger on_mix_publish_feed
  after insert on public.mixes
  for each row
  when (new.published = true)
  execute function public.handle_mix_publish_feed();

-- ===== 6.3 + 6.4: CURSOR-BASED FEED RPCS =====

-- Following feed: reads from pre-populated feed_events (fan-out)
-- Cursor: (created_at) — returns items BEFORE cursor
create or replace function public.get_feed_cursor(
  p_user_id uuid,
  p_limit int default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  title text,
  artwork_url text,
  audio_url text,
  duration_seconds int,
  play_count int,
  like_count int,
  comment_count int,
  genre_name text,
  tags text[],
  waveform_url text,
  audio_quality text,
  status text,
  created_at timestamptz,
  dj_id uuid,
  dj_username text,
  dj_display_name text,
  dj_avatar_url text
)
language sql
stable
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.audio_quality, m.status,
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

-- Trending feed: computed from mix_scores (materialized)
-- Cursor: (score, id) — returns items with score <= cursor OR same score + higher id
create or replace function public.get_trending_cursor(
  p_limit int default 20,
  p_cursor_score float default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  title text,
  artwork_url text,
  audio_url text,
  duration_seconds int,
  play_count int,
  like_count int,
  comment_count int,
  genre_name text,
  tags text[],
  waveform_url text,
  audio_quality text,
  status text,
  weekly_plays int,
  score float,
  created_at timestamptz,
  dj_id uuid,
  dj_username text,
  dj_display_name text,
  dj_avatar_url text
)
language sql
stable
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.audio_quality, m.status,
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

-- Latest feed: direct query, cursor-based on created_at
create or replace function public.get_latest_cursor(
  p_limit int default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  title text,
  artwork_url text,
  audio_url text,
  duration_seconds int,
  play_count int,
  like_count int,
  comment_count int,
  genre_name text,
  tags text[],
  waveform_url text,
  audio_quality text,
  status text,
  created_at timestamptz,
  dj_id uuid,
  dj_username text,
  dj_display_name text,
  dj_avatar_url text
)
language sql
stable
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.audio_quality, m.status,
    m.created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url
  from public.mixes m
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where m.published = true
    and m.status = 'ready'
    and (p_cursor_created_at is null
      or m.created_at < p_cursor_created_at)
  order by m.created_at desc
  limit p_limit;
$$;

-- ===== 6.5: FANS ALSO LIKED RECOMMENDATIONS =====

create or replace function public.get_fans_also_liked(
  p_mix_id uuid,
  p_limit int default 5
)
returns table (
  id uuid,
  title text,
  artwork_url text,
  audio_url text,
  duration_seconds int,
  play_count int,
  like_count int,
  genre_name text,
  created_at timestamptz,
  dj_id uuid,
  dj_username text,
  dj_display_name text,
  dj_avatar_url text
)
language sql
stable
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
  where m.published = true
    and m.status = 'ready';
$$;

-- ===== 6.6: DISCOVERY FEED =====

create or replace function public.get_discovery(
  p_user_id uuid,
  p_limit int default 20,
  p_cursor_score float default null
)
returns table (
  id uuid,
  title text,
  artwork_url text,
  audio_url text,
  duration_seconds int,
  play_count int,
  like_count int,
  comment_count int,
  genre_name text,
  tags text[],
  waveform_url text,
  audio_quality text,
  status text,
  weekly_plays int,
  score float,
  created_at timestamptz,
  dj_id uuid,
  dj_username text,
  dj_display_name text,
  dj_avatar_url text
)
language sql
stable
as $$
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.audio_quality, m.status,
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

-- ===== UPDATE MIX SCORES ON NEW PLAYS/LIKES (lightweight incremental) =====

-- Incrementally update mix_scores when a play is recorded
create or replace function public.update_mix_score_on_play()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.mix_scores (mix_id, score, weekly_plays, weekly_likes, updated_at)
  values (new.mix_id, 1.0, 1, 0, now())
  on conflict (mix_id) do update set
    score = public.mix_scores.score + 1.0,
    weekly_plays = public.mix_scores.weekly_plays + 1,
    updated_at = now();
  return new;
end;
$$;

create trigger on_play_for_scores
  after insert on public.play_history
  for each row
  execute function public.update_mix_score_on_play();

-- Incrementally update mix_scores when a like is recorded
create or replace function public.update_mix_score_on_like()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.mix_scores (mix_id, score, weekly_plays, weekly_likes, updated_at)
  values (new.mix_id, 3.0, 0, 1, now())
  on conflict (mix_id) do update set
    score = public.mix_scores.score + 3.0,
    weekly_likes = public.mix_scores.weekly_likes + 1,
    updated_at = now();
  return new;
end;
$$;

create trigger on_like_for_scores
  after insert on public.likes
  for each row
  execute function public.update_mix_score_on_like();

-- Decrement on unlike
create or replace function public.update_mix_score_on_unlike()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.mix_scores
  set score = greatest(score - 3.0, 0),
      weekly_likes = greatest(weekly_likes - 1, 0),
      updated_at = now()
  where mix_id = old.mix_id;
  return old;
end;
$$;

create trigger on_unlike_for_scores
  after delete on public.likes
  for each row
  execute function public.update_mix_score_on_unlike();

-- ===== SEED INITIAL SCORES FOR EXISTING DATA =====

-- Run once after migration to populate scores for existing mixes
-- select refresh_mix_scores();
