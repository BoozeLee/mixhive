-- Migration 072: profiles.web3_tier + wallet_links table
--
-- Adds the per-user web3 tier flag (doc 35 §4.2) and the multi-wallet
-- support table (doc 36 §4). The tier column is an integer 0-2:
--   0 = no web3 features
--   1 = wallet connected / readable
--   2 = minting / claiming enabled
-- wallet_links replaces the single profiles.wallet_address for users who
-- want to link multiple addresses or use an embedded wallet.
--
-- Resolves: Phase 9 — blockchain integration controls

begin;

-- ── 1. profiles.web3_tier ────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists web3_tier int not null default 0;

create index if not exists idx_profiles_web3_tier
  on public.profiles(web3_tier)
  where web3_tier > 0;

-- ── 2. wallet_links table ────────────────────────────────────────────────────

create table if not exists public.wallet_links (
  id             uuid        primary key default gen_random_uuid(),
  profile_id     uuid        not null references public.profiles(id) on delete cascade,
  wallet_address text        not null,
  chain          text        not null default 'base',
  wallet_type    text        not null default 'external', -- 'external' | 'embedded'
  created_at     timestamptz default now(),
  constraint wallet_links_type_check check (wallet_type in ('external', 'embedded')),
  constraint wallet_links_chain_check check (chain in ('base', 'optimism', 'arbitrum'))
);

-- One wallet address per (profile, chain) combination
create unique index if not exists idx_wallet_links_unique
  on public.wallet_links(profile_id, wallet_address, chain);

create index if not exists idx_wallet_links_profile
  on public.wallet_links(profile_id);

create index if not exists idx_wallet_links_address
  on public.wallet_links(wallet_address);

-- ── 3. RLS for wallet_links ──────────────────────────────────────────────────

alter table public.wallet_links enable row level security;

drop policy if exists "wallet_links: owner can read" on public.wallet_links;
create policy "wallet_links: owner can read"
  on public.wallet_links for select
  using (profile_id = auth.uid());

drop policy if exists "wallet_links: owner can insert" on public.wallet_links;
create policy "wallet_links: owner can insert"
  on public.wallet_links for insert
  with check (profile_id = auth.uid());

drop policy if exists "wallet_links: owner can delete" on public.wallet_links;
create policy "wallet_links: owner can delete"
  on public.wallet_links for delete
  using (profile_id = auth.uid());

-- Realtime publication
do $$ begin
  alter publication supabase_realtime add table public.wallet_links;
exception when duplicate_object then null; end $$;

-- Resolves: Phase 9 doc 35 §4.2 (web3_tier) and doc 36 §4 (wallet_links)

commit;
