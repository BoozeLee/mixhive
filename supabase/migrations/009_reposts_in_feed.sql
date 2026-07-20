-- Migration 009: surface reposts in the personalised feed
--
-- The repost feature was wired through the DB (feed_events accepts
-- type='repost' with a unique partial index preventing duplicates) and the
-- client (`repost()` and `hasReposted()` in src/lib/api.ts) — but
-- get_feed_cursor() only returned mix_upload events, so reposts were
-- invisible to followers.
--
-- This migration:
--   1. Re-implements get_feed_cursor() as a UNION of mix_uploads (fanned
--      out via target_id) and reposts (resolved through follows).
--   2. Adds repost-attribution columns to the return shape so the client
--      can render a "Reposted by @username" header on the card.
--   3. Adds a helper RPC `unrepost()` so the toggle is server-authoritative
--      (uniqueness is enforced by the partial index from migration 001).
--
-- Resolves: #1

begin;

-- ===== Re-create get_feed_cursor with repost support =====
drop function if exists public.get_feed_cursor(uuid, int, timestamptz, uuid);

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
  dj_avatar_url text,
  is_repost boolean,
  reposted_by_id uuid,
  reposted_by_username text,
  reposted_by_display_name text,
  reposted_by_avatar_url text,
  feed_event_id uuid
)
language sql
stable
as $$
  with feed as (
    -- Mix uploads fanned out via target_id (existing path)
    select
      fe.id              as fe_id,
      fe.created_at      as fe_created_at,
      m.id               as m_id,
      false              as is_repost,
      null::uuid         as rb_id,
      null::text         as rb_username,
      null::text         as rb_display_name,
      null::text         as rb_avatar_url
    from public.feed_events fe
    join public.mixes m on m.id = fe.mix_id
    where fe.target_id = p_user_id
      and fe.type = 'mix_upload'

    union all

    -- Reposts from DJs the user follows. Excluded: self-reposts (don't
    -- inflate own feed), reposts of mixes by people the user has blocked.
    select
      fe.id              as fe_id,
      fe.created_at      as fe_created_at,
      m.id               as m_id,
      true               as is_repost,
      rb.id              as rb_id,
      rb.username        as rb_username,
      rb.display_name    as rb_display_name,
      rb.avatar_url      as rb_avatar_url
    from public.feed_events fe
    join public.follows f
      on f.following_id = fe.actor_id
     and f.follower_id = p_user_id
    join public.profiles rb on rb.id = fe.actor_id
    join public.mixes m on m.id = fe.mix_id
    where fe.type = 'repost'
      and fe.actor_id <> p_user_id
      and not exists (
        select 1 from public.user_blocks ub
        where ub.blocker_id = p_user_id
          and ub.blocked_id in (fe.actor_id, m.dj_id)
      )
  )
  select
    m.id, m.title, m.artwork_url, m.audio_url, m.duration_seconds,
    m.play_count, m.like_count, m.comment_count,
    g.name as genre_name, m.tags, m.waveform_url, m.audio_quality, m.status,
    feed.fe_created_at as created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url,
    feed.is_repost,
    feed.rb_id           as reposted_by_id,
    feed.rb_username     as reposted_by_username,
    feed.rb_display_name as reposted_by_display_name,
    feed.rb_avatar_url   as reposted_by_avatar_url,
    feed.fe_id           as feed_event_id
  from feed
  join public.mixes m on m.id = feed.m_id
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where m.published = true
    and (
      p_cursor_created_at is null
      or feed.fe_created_at < p_cursor_created_at
      or (feed.fe_created_at = p_cursor_created_at and feed.fe_id > p_cursor_id)
    )
  order by feed.fe_created_at desc, feed.fe_id asc
  limit p_limit;
$$;

-- ===== unrepost helper =====
-- Server-authoritative inverse of `repost()`. Idempotent — returns true if a
-- row was removed, false otherwise. Enforced by the RLS policies on
-- feed_events (actor_id must equal auth.uid() for delete).
create or replace function public.unrepost(p_mix_id uuid)
returns boolean
language plpgsql
security invoker
as $$
declare
  v_deleted int;
begin
  delete from public.feed_events
   where actor_id = auth.uid()
     and mix_id   = p_mix_id
     and type     = 'repost';
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- Ensure DELETE on own feed_events is allowed (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'feed_events'
      and policyname = 'Users can delete own feed_events'
  ) then
    create policy "Users can delete own feed_events"
      on public.feed_events for delete
      using (actor_id = auth.uid());
  end if;
end$$;

commit;
