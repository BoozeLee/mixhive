-- Migration 095: reliable web-push delivery, preferences, and notification type repair

begin;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'like', 'follow', 'comment', 'reply', 'mix_upload', 'mention',
    'buzz_like', 'repost', 'verification', 'message',
    'agent_notification', 'agent_purchased', 'agent_sale',
    'gear_sale', 'gear_shipped', 'gear_delivered', 'gear_confirmed',
    'gear_payout', 'gear_refunded', 'gear_disputed', 'earnings_paid'
  ]));

alter table public.notifications
  add column if not exists body text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- A browser endpoint must belong to only the most recently subscribed account.
delete from public.push_subscriptions older
using public.push_subscriptions newer
where older.endpoint = newer.endpoint
  and (older.created_at, older.id) < (newer.created_at, newer.id);

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_unique_endpoint;

create unique index if not exists push_subscriptions_endpoint_unique
  on public.push_subscriptions (endpoint);

create table if not exists public.notification_preferences (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  push_enabled        boolean not null default false,
  messages_enabled    boolean not null default true,
  social_enabled      boolean not null default true,
  uploads_enabled     boolean not null default true,
  account_enabled     boolean not null default true,
  updated_at          timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_owner_select"
  on public.notification_preferences for select
  using (user_id = auth.uid());

create policy "notification_preferences_owner_insert"
  on public.notification_preferences for insert
  with check (user_id = auth.uid());

create policy "notification_preferences_owner_update"
  on public.notification_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.push_delivery_jobs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  subscription_id   uuid not null references public.push_subscriptions(id) on delete cascade,
  notification_id   uuid references public.notifications(id) on delete cascade,
  digest_key        text,
  payload           jsonb not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts          integer not null default 0,
  next_attempt_at   timestamptz not null default now(),
  last_error        text,
  created_at        timestamptz not null default now(),
  delivered_at      timestamptz,
  constraint push_delivery_job_source check (
    (notification_id is not null and digest_key is null)
    or (notification_id is null and digest_key is not null)
  )
);

create unique index if not exists push_delivery_jobs_notification_unique
  on public.push_delivery_jobs (subscription_id, notification_id)
  where notification_id is not null;

create unique index if not exists push_delivery_jobs_digest_unique
  on public.push_delivery_jobs (subscription_id, digest_key)
  where digest_key is not null;

create index if not exists push_delivery_jobs_due_idx
  on public.push_delivery_jobs (status, next_attempt_at);

alter table public.push_delivery_jobs enable row level security;

commit;
