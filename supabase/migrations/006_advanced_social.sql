-- Mix Hive v6 - Advanced Social (Mentions, Blocks, Activity, Recommendations)
-- Run after 005_playlists.sql

-- ===== 8.1: USER BLOCKS =====

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id != blocked_id)
);

create index idx_user_blocks_blocker on public.user_blocks(blocker_id);
create index idx_user_blocks_blocked on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

create policy "Users can block"
  on public.user_blocks for insert
  with check (blocker_id = auth.uid());

create policy "Users can unblock"
  on public.user_blocks for delete
  using (blocker_id = auth.uid());

create policy "Users can see own blocks"
  on public.user_blocks for select
  using (blocker_id = auth.uid());

-- ===== UPDATE NOTIFICATIONS TYPE CHECK =====

-- Extend notifications type to include 'mention'
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'follow', 'comment', 'reply', 'mix_upload', 'mention'));

-- ===== 8.2: MENTION NOTIFICATION TRIGGER =====

-- Trigger: when a comment mentions @username, create notification
create or replace function public.handle_mention_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  mentioned_user_id uuid;
  mention_pattern text;
begin
  for mention_pattern in
    select unnest(regexp_matches(new.body, '@([A-Za-z0-9_]+)', 'g'))
  loop
    select id into mentioned_user_id
    from public.profiles
    where username = mention_pattern
    limit 1;

    if found and mentioned_user_id != new.user_id then
      insert into public.notifications (user_id, type, actor_id, mix_id, data)
      values (mentioned_user_id, 'mention', new.user_id, new.mix_id,
        jsonb_build_object('comment_id', new.id, 'mention', mention_pattern));
    end if;
  end loop;
  return new;
end;
$$;

create trigger on_comment_mention
  after insert on public.comments
  for each row
  execute function public.handle_mention_notification();

-- ===== 8.3: ACTIVITY FEED =====

create or replace function public.get_user_activity(
  p_user_id uuid,
  p_limit int default 20
)
returns table (
  activity_type text,
  actor_id uuid,
  target_id uuid,
  mix_id uuid,
  target_username text,
  target_display_name text,
  mix_title text,
  created_at timestamptz
)
language sql
stable
as $$
  -- Recent mix uploads
  select
    'upload' as activity_type,
    m.dj_id as actor_id,
    null::uuid as target_id,
    m.id as mix_id,
    null::text as target_username,
    null::text as target_display_name,
    m.title as mix_title,
    m.created_at
  from public.mixes m
  where m.dj_id = p_user_id
    and m.published = true

  union all

  -- Recent likes
  select
    'like' as activity_type,
    l.user_id as actor_id,
    null::uuid as target_id,
    l.mix_id,
    null::text,
    null::text,
    m.title as mix_title,
    l.created_at
  from public.likes l
  join public.mixes m on m.id = l.mix_id
  where l.user_id = p_user_id

  union all

  -- Recent follows
  select
    'follow' as activity_type,
    f.follower_id as actor_id,
    f.following_id as target_id,
    null::uuid as mix_id,
    p.username as target_username,
    p.display_name as target_display_name,
    null::text as mix_title,
    f.created_at
  from public.follows f
  join public.profiles p on p.id = f.following_id
  where f.follower_id = p_user_id

  order by created_at desc
  limit p_limit;
$$;

-- ===== 8.4: RECOMMENDED DJS =====

create or replace function public.get_recommended_djs(
  p_user_id uuid,
  p_limit int default 5
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  recent_mix_title text,
  recent_mix_created_at timestamptz
)
language sql
stable
as $$
  select
    p.id, p.username, p.display_name, p.avatar_url, p.bio,
    m.title as recent_mix_title,
    m.created_at as recent_mix_created_at
  from public.profiles p
  join lateral (
    select title, created_at
    from public.mixes
    where dj_id = p.id
      and published = true
      and status = 'ready'
    order by created_at desc
    limit 1
  ) m on true
  where p.id != p_user_id
    and p.id not in (
      select following_id from public.follows where follower_id = p_user_id
    )
    and p.id not in (
      select blocked_id from public.user_blocks where blocker_id = p_user_id
    )
  order by m.created_at desc
  limit p_limit;
$$;

-- ===== RLS: EXCLUDE BLOCKED USERS FROM CONTENT =====

-- Create a helper function to check if a user is blocked
create or replace function public.is_blocked_by(target_id uuid, viewer_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = target_id and blocked_id = viewer_id
  );
$$;

-- Drop existing policies on profiles
drop policy if exists "Profiles are publicly readable" on public.profiles;

-- Profiles: exclude blocked users
create policy "Profiles are publicly readable (excl. blocked)"
  on public.profiles for select
  using (
    not exists (
      select 1 from public.user_blocks
      where blocker_id = id and blocked_id = auth.uid()
    )
  );

-- Mixes: exclude mixes from blocked DJs
drop policy if exists "Published mixes are publicly readable" on public.mixes;

create policy "Published mixes are publicly readable (excl. blocked)"
  on public.mixes for select
  using (
    (published = true or dj_id = auth.uid())
    and not exists (
      select 1 from public.user_blocks
      where blocker_id = dj_id and blocked_id = auth.uid()
    )
  );

-- Comments: exclude comments from blocked users
drop policy if exists "Comments are publicly readable" on public.comments;

create policy "Comments are publicly readable (excl. blocked)"
  on public.comments for select
  using (
    not exists (
      select 1 from public.user_blocks
      where blocker_id = user_id and blocked_id = auth.uid()
    )
  );
