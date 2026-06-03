-- Migration 040: Add buzz_like and repost notification triggers, fix Lua reply trigger
--
-- 1. Add buzz_like trigger: fires on insert into buzz_likes table
-- 2. Add repost trigger: fires on insert into feed_events where type='repost' 
-- 3. Fix Lua reply trigger: correct parent_comment_id -> parent_id in migration 014 function

-- ===== 1. Buzz Like Notification Trigger =====

create or replace function public.handle_buzz_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id, buzz_id, data)
  select 
    b.author_id,
    'buzz_like',
    new.user_id,
    b.id,
    jsonb_build_object('buzz_id', b.id)
  from public.buzzes b
  where b.id = new.buzz_id
    and b.author_id <> new.user_id; -- Don't notify self
  return new;
end;
$$;

drop trigger if exists on_buzz_like_notification on public.buzz_likes;
create trigger on_buzz_like_notification
after insert on public.buzz_likes
for each row execute function public.handle_buzz_like_notification();

-- ===== 2. Repost Notification Trigger =====

create or replace function public.handle_repost_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id, buzz_id, data)
  select
    b.author_id,
    'repost',
    new.actor_id,
    b.id,
    jsonb_build_object('buzz_id', b.id)
  from public.feed_events fe
  join public.buzzes b on fe.buzz_id = b.id
  where fe.id = new.id
    and fe.type = 'repost'
    and b.author_id <> new.actor_id; -- Don't notify self
  return new;
end;
$$;

drop trigger if exists on_repost_notification on public.feed_events;
create trigger on_repost_notification
after insert on public.feed_events
for each row
when (new.type = 'repost')
execute function public.handle_repost_notification();

-- ===== 3. Fix Lua Reply Trigger (Migration 014) =====

-- Fix the handle_reply_notification function in 002_notification_triggers.sql
-- The original had a bug referencing parent_comment_id which doesn't exist
-- It should reference parent_id (the actual column name)

drop function if exists public.handle_reply_notification();
create or replace function public.handle_reply_notification()
returns trigger as $$
declare
  parent_author_id uuid;
  mix_owner_id uuid;
begin
  -- Only fire for replies
  if new.parent_id is null then
    return new;
  end if;

  -- Get the author of the parent comment
  select user_id into parent_author_id
  from public.comments
  where id = new.parent_id;

  -- Don't notify yourself
  if parent_author_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, type, actor_id, mix_id, data)
  values (
    parent_author_id,
    'reply',
    new.user_id,
    new.mix_id,
    jsonb_build_object('comment_id', new.id, 'parent_comment_id', new.parent_id)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_reply_notification on public.comments;
create trigger on_reply_notification
after insert on public.comments
for each row execute function public.handle_reply_notification();

-- Note: The actual fix to migration 014_lua_more_triggers.sql would be:
-- In that file, change "parent_comment_id" to "parent_id" in the handle_reply_notification function
-- But since we can't modify existing migrations per CLAUDE.md, we override the function here