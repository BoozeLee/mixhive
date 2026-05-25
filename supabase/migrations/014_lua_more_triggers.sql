-- Migration 014: wire the remaining event triggers into the Lua dispatcher
--
-- Migration 013 added on_follow + on_comment. This migration finishes the
-- catalog: on_unfollow, on_mix_upload, on_like, on_repost, on_mention.
-- Each one is a thin Postgres trigger that calls dispatch_lua_event(),
-- which fans the event out to every enabled agent the recipient owns
-- whose trigger_type matches.

begin;

-- on_unfollow ----------------------------------------------------------
create or replace function public.lua_on_unfollow()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.dispatch_lua_event(
    old.following_id,
    'on_unfollow',
    jsonb_build_object('actor_id', old.follower_id, 'removed_at', now())
  );
  return old;
end;
$$;

drop trigger if exists on_unfollow_dispatch_lua on public.follows;
create trigger on_unfollow_dispatch_lua
  after delete on public.follows
  for each row execute function public.lua_on_unfollow();


-- on_mix_upload --------------------------------------------------------
-- Fan out to every follower of the uploading DJ. We piggy-back on the
-- existing fan-out in handle_mix_upload_notification (migration 002)
-- by walking follows here too — a single trigger keeps the contract
-- self-contained.
create or replace function public.lua_on_mix_upload()
returns trigger
language plpgsql
security definer
as $$
declare
  v_follower uuid;
begin
  if new.published <> true then return new; end if;
  for v_follower in
    select follower_id
      from public.follows
     where following_id = new.dj_id
  loop
    perform public.dispatch_lua_event(
      v_follower,
      'on_mix_upload',
      jsonb_build_object(
        'actor_id', new.dj_id,
        'mix_id', new.id,
        'title', new.title,
        'genre_id', new.genre_id,
        'created_at', new.created_at
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists on_mix_upload_dispatch_lua on public.mixes;
create trigger on_mix_upload_dispatch_lua
  after insert on public.mixes
  for each row execute function public.lua_on_mix_upload();


-- on_like --------------------------------------------------------------
create or replace function public.lua_on_like()
returns trigger
language plpgsql
security definer
as $$
declare
  v_mix_owner uuid;
begin
  select dj_id into v_mix_owner from public.mixes where id = new.mix_id;
  if v_mix_owner is null or v_mix_owner = new.user_id then return new; end if;
  perform public.dispatch_lua_event(
    v_mix_owner,
    'on_like',
    jsonb_build_object(
      'actor_id', new.user_id,
      'mix_id', new.mix_id,
      'created_at', new.created_at
    )
  );
  return new;
end;
$$;

drop trigger if exists on_like_dispatch_lua on public.likes;
create trigger on_like_dispatch_lua
  after insert on public.likes
  for each row execute function public.lua_on_like();


-- on_repost ------------------------------------------------------------
-- Reposts are stored as feed_events with type='repost'. Notify the
-- original DJ (target_id) so agents can react to "someone reposted me".
create or replace function public.lua_on_repost()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.type <> 'repost' then return new; end if;
  if new.actor_id = new.target_id then return new; end if;
  perform public.dispatch_lua_event(
    new.target_id,
    'on_repost',
    jsonb_build_object(
      'actor_id', new.actor_id,
      'mix_id', new.mix_id,
      'feed_event_id', new.id,
      'created_at', new.created_at
    )
  );
  return new;
end;
$$;

drop trigger if exists on_repost_dispatch_lua on public.feed_events;
create trigger on_repost_dispatch_lua
  after insert on public.feed_events
  for each row execute function public.lua_on_repost();


-- on_mention -----------------------------------------------------------
-- Mentions are already extracted from comment bodies by the trigger in
-- migration 006 (handle_mention_notification). We piggy-back: the
-- notification insert with type='mention' is the canonical signal.
create or replace function public.lua_on_mention()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.type <> 'mention' then return new; end if;
  perform public.dispatch_lua_event(
    new.user_id,
    'on_mention',
    jsonb_build_object(
      'actor_id', new.actor_id,
      'source_type', coalesce(new.data->>'source_type', 'comment'),
      'source_id', coalesce(new.data->>'source_id', new.mix_id::text),
      'context', new.data->>'snippet',
      'created_at', new.created_at
    )
  );
  return new;
end;
$$;

drop trigger if exists on_mention_dispatch_lua on public.notifications;
create trigger on_mention_dispatch_lua
  after insert on public.notifications
  for each row execute function public.lua_on_mention();

commit;
