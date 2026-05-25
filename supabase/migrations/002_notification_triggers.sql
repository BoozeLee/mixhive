-- Mix Hive v2 - Reply & Mix Upload Notification Triggers
-- Run this after 001_mixhive_schema.sql

-- Fix typo in 001: greaters -> greatest
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

-- 1. Reply notification trigger
-- Fires when a comment.reply (parent_id IS NOT NULL) is inserted
-- Notifies the parent comment author
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

create trigger on_reply_notification
  after insert on public.comments
  for each row execute function public.handle_reply_notification();

-- 2. Mix upload notification trigger
-- Fires when a mix is inserted with published = true
-- Notifies all followers of the DJ
create or replace function public.handle_mix_upload_notification()
returns trigger as $$
begin
  -- Only fire for published mixes
  if new.published is false then
    return new;
  end if;

  -- Notify all followers of the DJ
  insert into public.notifications (user_id, type, actor_id, mix_id, data)
  select
    follower_id,
    'mix_upload',
    new.dj_id,
    new.id,
    jsonb_build_object('mix_title', new.title)
  from public.follows
  where following_id = new.dj_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_mix_upload_notification
  after insert on public.mixes
  for each row execute function public.handle_mix_upload_notification();
