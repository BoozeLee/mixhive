-- Subscription tiers + user subscriptions table for Stripe Billing.
-- Supports: free | supporter (€5) | insider (€12) | patron (€25)
begin;

-- 1. tier enum
do $$ begin
  create type subscription_tier as enum ('free', 'supporter', 'insider', 'patron');
exception
  when duplicate_object then null;
end $$;

-- 2. stripe_customer_id on profiles (set once when user first subscribes)
alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists idx_profiles_stripe_customer_id
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

-- 3. user_subscriptions table
create table if not exists public.user_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade unique,
  tier                   subscription_tier not null default 'free',
  stripe_subscription_id text,
  status                 text not null default 'incomplete'
                             check (status in ('active','canceled','past_due','incomplete','incomplete_expired','trialing','unpaid')),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_status
  on public.user_subscriptions (status);

-- 4. RLS: user reads own, service role writes
alter table public.user_subscriptions enable row level security;

drop policy if exists "user_subscriptions_select_own" on public.user_subscriptions;
create policy "user_subscriptions_select_own"
  on public.user_subscriptions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Trigger to set updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_subscriptions_updated_at on public.user_subscriptions;
create trigger trg_user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row
  execute function public.set_updated_at();

-- Seed a free row for every new user (called by signup trigger or insert)
create or replace function public.ensure_user_subscription()
returns trigger as $$
begin
  insert into public.user_subscriptions (user_id, tier, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_ensure_user_subscription on auth.users;
create trigger trg_ensure_user_subscription
  after insert on auth.users
  for each row
  execute function public.ensure_user_subscription();

commit;
