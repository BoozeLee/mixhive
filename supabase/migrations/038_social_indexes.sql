-- Migration 038: Social query indexes (non-concurrent variant for transaction-safe execution)

create index if not exists idx_follows_following_created
  on public.follows (following_id, created_at desc);

create index if not exists idx_likes_mix_user
  on public.likes (mix_id, user_id);

create index if not exists idx_comments_mix_created
  on public.comments (mix_id, created_at desc);

create index if not exists idx_comments_parent_created
  on public.comments (parent_id, created_at asc);

create index if not exists idx_mixes_dj_created
  on public.mixes (dj_id, created_at desc);

create index if not exists idx_mixes_play_created
  on public.mixes (play_count desc, created_at desc);

create index if not exists idx_notifications_user_read_created
  on public.notifications (user_id, read, created_at desc);

create index if not exists idx_feed_events_target_created
  on public.feed_events (target_id, created_at desc);

create index if not exists idx_feed_events_target_type
  on public.feed_events (target_id, type);

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'buzzes') then
    create index if not exists idx_buzzes_author_created
      on public.buzzes (author_id, created_at desc);
    create index if not exists idx_buzzes_parent_created
      on public.buzzes (parent_buzz_id, created_at asc);
  end if;
end;
$$;
