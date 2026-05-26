-- Migration 024: Buzzes — short-form posts (tweets) on MixHive.
--
-- Adds the buzzes table (up to 280-char text + optional image / audio /
-- video / code snippet / embedded mix link), engagement tables
-- buzz_likes and buzz_reposts, count-maintenance triggers, feed-fanout
-- trigger so followers see top-level buzzes alongside mix cards, and
-- full RLS policies.
--
-- feed_events.type check is widened to include 'buzz' and a nullable
-- buzz_id FK column is added so the feed cursor can join buzz metadata.
--
-- Storage: create the buzz-media bucket (public, 50 MB per file) via
-- the Supabase dashboard or CLI after applying this migration:
--   supabase storage create buzz-media --public
--
-- Resolves: Buzz post feature

begin;

-- ===== 1. BUZZES =====

create table if not exists public.buzzes (
  id               uuid        primary key default uuid_generate_v4(),
  author_id        uuid        not null references public.profiles(id) on delete cascade,
  body             text        not null check (char_length(body) between 1 and 280),
  image_url        text,
  audio_url        text,
  video_url        text,
  code_snippet     text,
  code_language    text,
  attached_mix_id  uuid        references public.mixes(id) on delete set null,
  parent_buzz_id   uuid        references public.buzzes(id) on delete cascade,
  is_repost        boolean     not null default false,
  original_buzz_id uuid        references public.buzzes(id) on delete cascade,
  like_count       int         not null default 0,
  reply_count      int         not null default 0,
  repost_count     int         not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_buzzes_author       on public.buzzes(author_id, created_at desc);
create index if not exists idx_buzzes_created      on public.buzzes(created_at desc);
create index if not exists idx_buzzes_parent       on public.buzzes(parent_buzz_id)
  where parent_buzz_id is not null;
create index if not exists idx_buzzes_attached_mix on public.buzzes(attached_mix_id)
  where attached_mix_id is not null;

-- ===== 2. ENGAGEMENT TABLES =====

create table if not exists public.buzz_likes (
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  buzz_id    uuid        not null references public.buzzes(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, buzz_id)
);

create index if not exists idx_buzz_likes_buzz on public.buzz_likes(buzz_id);
create index if not exists idx_buzz_likes_user on public.buzz_likes(user_id);

create table if not exists public.buzz_reposts (
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  buzz_id    uuid        not null references public.buzzes(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, buzz_id)
);

create index if not exists idx_buzz_reposts_buzz on public.buzz_reposts(buzz_id);
create index if not exists idx_buzz_reposts_user on public.buzz_reposts(user_id);

-- ===== 3. COUNT TRIGGERS =====

create or replace function public.handle_buzz_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.buzzes set like_count = like_count + 1 where id = new.buzz_id;
  elsif tg_op = 'DELETE' then
    update public.buzzes set like_count = greatest(like_count - 1, 0) where id = old.buzz_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_buzz_like_count on public.buzz_likes;
create trigger on_buzz_like_count
  after insert or delete on public.buzz_likes
  for each row execute function public.handle_buzz_like_count();

create or replace function public.handle_buzz_repost_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.buzzes set repost_count = repost_count + 1 where id = new.buzz_id;
  elsif tg_op = 'DELETE' then
    update public.buzzes set repost_count = greatest(repost_count - 1, 0) where id = old.buzz_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_buzz_repost_count on public.buzz_reposts;
create trigger on_buzz_repost_count
  after insert or delete on public.buzz_reposts
  for each row execute function public.handle_buzz_repost_count();

create or replace function public.handle_buzz_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.parent_buzz_id is not null then
    update public.buzzes set reply_count = reply_count + 1
    where id = new.parent_buzz_id;
  elsif tg_op = 'DELETE' and old.parent_buzz_id is not null then
    update public.buzzes set reply_count = greatest(reply_count - 1, 0)
    where id = old.parent_buzz_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_buzz_reply_count on public.buzzes;
create trigger on_buzz_reply_count
  after insert or delete on public.buzzes
  for each row execute function public.handle_buzz_reply_count();

-- ===== 4. FEED EVENTS EXTENSION =====

-- Add nullable buzz_id so feed rows can reference a buzz instead of a mix.
alter table public.feed_events
  add column if not exists buzz_id uuid references public.buzzes(id) on delete cascade;

-- Widen the type CHECK to accept 'buzz' events.
-- PostgreSQL auto-names inline CHECK constraints as {table}_{col}_check.
alter table public.feed_events
  drop constraint if exists feed_events_type_check;
alter table public.feed_events
  add constraint feed_events_type_check
  check (type in ('mix_upload', 'like', 'follow', 'repost', 'buzz'));

-- Fanout: on new top-level buzz, push a feed event to every follower.
create or replace function public.handle_buzz_feed_fanout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_buzz_id is null and new.is_repost = false then
    insert into public.feed_events (actor_id, type, buzz_id, target_id)
    select new.author_id, 'buzz', new.id, follower_id
    from public.follows
    where following_id = new.author_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_buzz_feed_fanout on public.buzzes;
create trigger on_buzz_feed_fanout
  after insert on public.buzzes
  for each row execute function public.handle_buzz_feed_fanout();

-- ===== 5. RLS =====

alter table public.buzzes       enable row level security;
alter table public.buzz_likes   enable row level security;
alter table public.buzz_reposts enable row level security;

drop policy if exists "Buzzes are publicly readable"  on public.buzzes;
create policy "Buzzes are publicly readable"
  on public.buzzes for select using (true);

drop policy if exists "Users can insert own buzzes"   on public.buzzes;
create policy "Users can insert own buzzes"
  on public.buzzes for insert with check (author_id = auth.uid());

drop policy if exists "Users can delete own buzzes"   on public.buzzes;
create policy "Users can delete own buzzes"
  on public.buzzes for delete using (author_id = auth.uid());

drop policy if exists "Buzz likes are publicly readable" on public.buzz_likes;
create policy "Buzz likes are publicly readable"
  on public.buzz_likes for select using (true);

drop policy if exists "Users can manage own buzz likes"  on public.buzz_likes;
create policy "Users can manage own buzz likes"
  on public.buzz_likes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Buzz reposts are publicly readable" on public.buzz_reposts;
create policy "Buzz reposts are publicly readable"
  on public.buzz_reposts for select using (true);

drop policy if exists "Users can manage own buzz reposts"  on public.buzz_reposts;
create policy "Users can manage own buzz reposts"
  on public.buzz_reposts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;

-- Resolves: Buzz post feature (024)
