-- Mix Hive - DJ Social Platform Schema
-- Run this in Supabase SQL Editor

-- 0. Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- 1. Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  banner_url text,
  bio text,
  location text,
  website text,
  genres text[] default '{}',
  social_links jsonb default '{}',
  is_dj boolean default true,
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_profiles_username on public.profiles(username);
create index idx_profiles_genres on public.profiles using gin(genres);

-- 2. Genres taxonomy
create table public.genres (
  id serial primary key,
  name text unique not null,
  slug text unique not null,
  description text,
  created_at timestamptz default now()
);

-- 3. Mixes
create table public.mixes (
  id uuid primary key default uuid_generate_v4(),
  dj_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  artwork_url text,
  audio_url text not null,
  duration_seconds int,
  genre_id int references public.genres(id),
  tags text[] default '{}',
  tracklist jsonb default '[]',
  platform_links jsonb default '{}',
  is_explicit boolean default false,
  play_count int default 0,
  like_count int default 0,
  comment_count int default 0,
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_mixes_dj on public.mixes(dj_id);
create index idx_mixes_genre on public.mixes(genre_id);
create index idx_mixes_published on public.mixes(published) where published = true;
create index idx_mixes_created on public.mixes(created_at desc);
create index idx_mixes_tags on public.mixes using gin(tags);

-- 4. Follows
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id != following_id)
);

create index idx_follows_follower on public.follows(follower_id);
create index idx_follows_following on public.follows(following_id);

-- 5. Likes
create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mix_id uuid not null references public.mixes(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, mix_id)
);

create index idx_likes_mix on public.likes(mix_id);
create index idx_likes_user on public.likes(user_id);

-- 6. Comments
create table public.comments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mix_id uuid not null references public.mixes(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_comments_mix on public.comments(mix_id);
create index idx_comments_user on public.comments(user_id);
create index idx_comments_parent on public.comments(parent_id);

-- 7. Play history (for trending)
create table public.play_history (
  id uuid primary key default uuid_generate_v4(),
  mix_id uuid not null references public.mixes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  played_at timestamptz default now()
);

create index idx_play_history_mix on public.play_history(mix_id);
create index idx_play_history_time on public.play_history(played_at desc);

-- 8. Notifications
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like', 'follow', 'comment', 'reply', 'mix_upload')),
  actor_id uuid references public.profiles(id) on delete cascade,
  mix_id uuid references public.mixes(id) on delete cascade,
  data jsonb default '{}',
  read boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- 9. Activity feed (materialized for performance)
create table public.feed_events (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('mix_upload', 'like', 'follow', 'repost')),
   mix_id uuid references public.mixes(id) on delete cascade,
   target_id uuid references public.profiles(id) on delete cascade,
   created_at timestamptz default now()
);

-- Prevent duplicate reposts from same actor on same mix
create unique index uq_feed_events_repost_unique
on public.feed_events(actor_id, mix_id)
where type = 'repost';

create index idx_feed_events_created on public.feed_events(created_at desc);

-- ===== ROW LEVEL SECURITY =====

alter table public.profiles enable row level security;
alter table public.mixes enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.play_history enable row level security;
alter table public.notifications enable row level security;
alter table public.feed_events enable row level security;

-- Profiles: public profiles are readable by anyone, only owner can update
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Mixes: published mixes are public, DJs can CRUD their own
create policy "Published mixes are publicly readable"
  on public.mixes for select using (published = true or dj_id = auth.uid());

create policy "DJs can insert own mixes"
  on public.mixes for insert with check (dj_id = auth.uid());

create policy "DJs can update own mixes"
  on public.mixes for update using (dj_id = auth.uid());

create policy "DJs can delete own mixes"
  on public.mixes for delete using (dj_id = auth.uid());

-- Follows: anyone can read, authenticated users can manage their own
create policy "Follows are publicly readable"
  on public.follows for select using (true);

create policy "Users can manage own follows"
  on public.follows for insert with check (follower_id = auth.uid());

create policy "Users can unfollow"
  on public.follows for delete using (follower_id = auth.uid());

-- Likes: anyone can read, authenticated users can manage their own
create policy "Likes are publicly readable"
  on public.likes for select using (true);

create policy "Users can manage own likes"
  on public.likes for insert with check (user_id = auth.uid());

create policy "Users can unlike"
  on public.likes for delete using (user_id = auth.uid());

-- Comments: anyone can read, authenticated users can create/edit own
create policy "Comments are publicly readable"
  on public.comments for select using (true);

create policy "Users can create comments"
  on public.comments for insert with check (user_id = auth.uid());

create policy "Users can update own comments"
  on public.comments for update using (user_id = auth.uid());

-- Notifications: only the recipient can read
create policy "Users can read own notifications"
  on public.notifications for select using (user_id = auth.uid());

-- ===== TRIGGER FUNCTIONS =====

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'preferred_username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update mix like_count on like/unlike
create or replace function public.update_mix_like_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.mixes set like_count = like_count + 1 where id = new.mix_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.mixes set like_count = greatest(like_count - 1, 0) where id = old.mix_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_like_change
  after insert or delete on public.likes
  for each row execute function public.update_mix_like_count();

-- Update mix comment_count on new comment
create or replace function public.update_mix_comment_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.mixes set comment_count = comment_count + 1 where id = new.mix_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.mixes set comment_count = greatest(comment_count - 1, 0) where id = old.mix_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_comment_change
  after insert or delete on public.comments
  for each row execute function public.update_mix_comment_count();

-- Create notification on like
create or replace function public.handle_like_notification()
returns trigger as $$
declare
  mix_owner uuid;
begin
  select dj_id into mix_owner from public.mixes where id = new.mix_id;
  if mix_owner != new.user_id then
    insert into public.notifications (user_id, type, actor_id, mix_id, data)
    values (mix_owner, 'like', new.user_id, new.mix_id, '{}');
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_like_notification
  after insert on public.likes
  for each row execute function public.handle_like_notification();

-- Create notification on follow
create or replace function public.handle_follow_notification()
returns trigger as $$
begin
  insert into public.notifications (user_id, type, actor_id, data)
  values (new.following_id, 'follow', new.follower_id, '{}');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_follow_notification
  after insert on public.follows
  for each row execute function public.handle_follow_notification();

-- Create notification on comment
create or replace function public.handle_comment_notification()
returns trigger as $$
declare
  mix_owner uuid;
begin
  select dj_id into mix_owner from public.mixes where id = new.mix_id;
  if mix_owner != new.user_id then
    insert into public.notifications (user_id, type, actor_id, mix_id, data)
    values (mix_owner, 'comment', new.user_id, new.mix_id, jsonb_build_object('comment_id', new.id));
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_comment_notification
  after insert on public.comments
  for each row execute function public.handle_comment_notification();

-- ===== SEED GENRES =====

insert into public.genres (name, slug, description) values
  ('House', 'house', 'House music - all subgenres'),
  ('Techno', 'techno', 'Techno and its variants'),
  ('Deep House', 'deep-house', 'Deep, soulful house music'),
  ('Tech House', 'tech-house', 'Techno-influenced house'),
  ('Progressive House', 'progressive-house', 'Melodic, building house'),
  ('Trance', 'trance', 'Uplifting, melodic electronic'),
  ('Drum & Bass', 'drum-and-bass', 'Fast breakbeats and bass'),
  ('Dubstep', 'dubstep', 'Heavy bass and wobbles'),
  ('UK Garage', 'uk-garage', 'UK garage and 2-step'),
  ('Breaks', 'breaks', 'Breakbeat and nu-skool'),
  ('Ambient', 'ambient', 'Atmospheric, downtempo'),
  ('Downtempo', 'downtempo', 'Chill, slower electronic'),
  ('Minimal', 'minimal', 'Minimal techno and house'),
  ('Electro', 'electro', 'Electro and electro house'),
  ('Disco', 'disco', 'Disco and nu-disco'),
  ('Funk / Soul', 'funk-soul', 'Funk, soul, and R&B'),
  ('Hip Hop', 'hip-hop', 'Hip hop and rap'),
  ('Jazz', 'jazz', 'Jazz and fusion'),
  ('World', 'world', 'World music and global beats'),
  ('Open Format', 'open-format', 'Multi-genre and open format sets'),
  ('Radio Show', 'radio-show', 'Regular radio shows and podcasts'),
  ('Live Set', 'live-set', 'Live recorded performances'),
  ('Boiler Room', 'boiler-room', 'Boiler room style sets'),
  ('Mashup', 'mashup', 'Mashups and edits')
on conflict (name) do nothing;

-- ===== HELPER FUNCTIONS =====

-- Increment play count on a mix
create or replace function public.increment_play_count(p_mix_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.mixes set play_count = play_count + 1 where id = p_mix_id;
end;
$$;

-- Get feed for a user (mixes from followed DJs)
create or replace function public.get_feed(p_user_id uuid, p_limit int default 20, p_offset int default 0)
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
    g.name as genre_name, m.tags, m.created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url
  from public.mixes m
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  where m.published = true
    and m.dj_id in (
      select following_id from public.follows where follower_id = p_user_id
    )
  order by m.created_at desc
  limit p_limit
  offset p_offset;
$$;

-- Get trending mixes (most plays in last 7 days)
create or replace function public.get_trending(p_limit int default 20, p_offset int default 0)
returns table (
  id uuid,
  title text,
  artwork_url text,
  audio_url text,
  duration_seconds int,
  play_count int,
  like_count int,
  comment_count int,
  weekly_plays bigint,
  genre_name text,
  tags text[],
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
    count(ph.id) as weekly_plays,
    g.name as genre_name, m.tags, m.created_at,
    p.id as dj_id, p.username as dj_username,
    p.display_name as dj_display_name, p.avatar_url as dj_avatar_url
  from public.mixes m
  join public.profiles p on p.id = m.dj_id
  left join public.genres g on g.id = m.genre_id
  left join public.play_history ph on ph.mix_id = m.id
    and ph.played_at > now() - interval '7 days'
  where m.published = true
  group by m.id, p.id, g.name
  order by weekly_plays desc, m.play_count desc
  limit p_limit
  offset p_offset;
$$;

-- Create storage buckets for mix audio and artwork
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('mix-audio', 'mix-audio', true, 104857600, array['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/mp4']),
  ('mix-artwork', 'mix-artwork', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
