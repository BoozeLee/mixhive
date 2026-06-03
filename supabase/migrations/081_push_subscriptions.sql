-- Migration 081: Web Push subscription storage
--
-- Stores browser PushSubscription objects per user so the hourly push-sender
-- cron can deliver browser notifications. Each (user_id, endpoint) pair is
-- unique — re-subscribing the same browser updates rather than duplicates.
-- Users own their own rows; service role handles cron reads and stale cleanup.
--
-- Resolves: Phase 16 — PWA push notifications

begin;

create table if not exists push_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references profiles(id) on delete cascade,
  endpoint     text        not null,
  p256dh       text        not null,
  auth         text        not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  constraint push_subscriptions_unique_endpoint unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_owner_select" on push_subscriptions;
create policy "push_subscriptions_owner_select"
  on push_subscriptions for select
  using (user_id = auth.uid());

drop policy if exists "push_subscriptions_owner_insert" on push_subscriptions;
create policy "push_subscriptions_owner_insert"
  on push_subscriptions for insert
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_owner_delete" on push_subscriptions;
create policy "push_subscriptions_owner_delete"
  on push_subscriptions for delete
  using (user_id = auth.uid());

commit;

-- Resolves: Phase 16 — PWA push notifications
