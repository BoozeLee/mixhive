-- Migration 084: Stripe Connect payout accounts
--
-- Phase 2 (Complete Monetization) wires Stripe Connect so sellers/creators can
-- cash out. Adds the connected-account fields to profiles and the PaymentIntent
-- id to equipment_transactions (needed to capture/transfer/refund at release —
-- the existing payment_reference holds the Checkout *session* id, not the PI).
--
-- These profile columns are SERVICE-ROLE-WRITE-ONLY: only the Connect onboard/
-- status routes and the Stripe webhook (service role) ever set them. No client
-- write policy is granted; the existing profiles RLS governs reads.
--
-- Resolves: Phase 2

begin;

alter table public.profiles
  add column if not exists stripe_account_id        text,
  add column if not exists payouts_enabled          boolean not null default false,
  add column if not exists charges_enabled          boolean not null default false,
  add column if not exists connect_onboarding_state text not null default 'none';

alter table public.profiles
  drop constraint if exists profiles_connect_onboarding_state_check;
alter table public.profiles
  add constraint profiles_connect_onboarding_state_check
  check (connect_onboarding_state in ('none','pending','restricted','enabled')) not valid;
alter table public.profiles
  validate constraint profiles_connect_onboarding_state_check;

-- One Stripe account per profile.
create unique index if not exists idx_profiles_stripe_account_id
  on public.profiles (stripe_account_id) where stripe_account_id is not null;

-- PaymentIntent id for the gear escrow charge (capture/transfer/refund key).
alter table public.equipment_transactions
  add column if not exists payment_intent_id text;

create index if not exists idx_equipment_transactions_payment_intent
  on public.equipment_transactions (payment_intent_id) where payment_intent_id is not null;

commit;

-- Resolves: Phase 2
