-- Migration 085: Marketplace payout ledger + paid listing boosts
--
-- Phase 2 records every Stripe Connect transfer (gear escrow release and agent
-- 70/30 payout) in an auditable ledger. The unique (source_type, source_id)
-- index is the idempotency guard: exactly one payout row per sale, so a webhook
-- or cron retry can never double-transfer. Rows are written by the service role
-- only; sellers can read their own. Also adds equipment_listings.boosted_until
-- for paid gear boosts.
--
-- Resolves: Phase 2

begin;

create table if not exists public.platform_fee_ledger (
  id                  uuid primary key default gen_random_uuid(),
  source_type         text not null check (source_type in ('gear','agent')),
  source_id           uuid not null,
  seller_profile_id   uuid references public.profiles(id) on delete set null,
  gross_amount        numeric(12,2) not null,
  platform_fee        numeric(12,2) not null,
  net_to_seller       numeric(12,2) not null,
  currency            char(3) not null default 'EUR',
  stripe_transfer_id  text,
  status              text not null default 'transferred'
                        check (status in ('transferred','held','reversed')),
  created_at          timestamptz not null default now()
);

-- Idempotency: one payout per source sale.
create unique index if not exists idx_fee_ledger_source
  on public.platform_fee_ledger (source_type, source_id);
create unique index if not exists idx_fee_ledger_transfer
  on public.platform_fee_ledger (stripe_transfer_id) where stripe_transfer_id is not null;
create index if not exists idx_fee_ledger_seller
  on public.platform_fee_ledger (seller_profile_id, created_at desc);
create index if not exists idx_fee_ledger_status
  on public.platform_fee_ledger (status) where status = 'held';

alter table public.platform_fee_ledger enable row level security;

-- Sellers/creators may read their own payout rows; writes are service-role only.
drop policy if exists "fee_ledger_owner_select" on public.platform_fee_ledger;
create policy "fee_ledger_owner_select"
  on public.platform_fee_ledger for select
  using (seller_profile_id = auth.uid());

-- Paid gear boosts surface a listing until this time.
alter table public.equipment_listings
  add column if not exists boosted_until timestamptz;

create index if not exists idx_equipment_listings_boosted
  on public.equipment_listings (boosted_until) where boosted_until is not null;

commit;

-- Resolves: Phase 2
