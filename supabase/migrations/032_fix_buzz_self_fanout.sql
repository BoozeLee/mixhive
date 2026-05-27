-- Migration 032: Fix buzz feed self-fanout — author sees own buzzes.
--
-- The original handle_buzz_feed_fanout (migration 024) fans out only to
-- followers. Authors never see their own top-level buzzes in the Following
-- feed after a page reload because there is no feed_events row where
-- target_id = author_id.
--
-- This replaces the function body to also insert one self-targeted row per
-- buzz, using ON CONFLICT DO NOTHING in case the row already exists from a
-- previous partial deploy.
--
-- feed_events has no unique constraint on (actor_id, buzz_id, target_id),
-- so we guard the self-row with a sub-select instead of ON CONFLICT.
--
-- Resolves: Bug — author's own buzzes invisible in Following feed on reload

begin;

create or replace function public.handle_buzz_feed_fanout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_buzz_id is null and new.is_repost = false then
    -- Fanout to every follower
    insert into public.feed_events (actor_id, type, buzz_id, target_id)
    select new.author_id, 'buzz', new.id, follower_id
    from public.follows
    where following_id = new.author_id;

    -- Also push a self-targeted event so the author sees their own buzz
    -- in the Following feed without relying on a client-side workaround.
    insert into public.feed_events (actor_id, type, buzz_id, target_id)
    values (new.author_id, 'buzz', new.id, new.author_id);
  end if;
  return new;
end;
$$;

commit;

-- Resolves: #032 — buzz self-fanout
