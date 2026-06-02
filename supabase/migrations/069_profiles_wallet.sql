-- Migration 069: Phase 8 — wallet address + NFT feed preference on profiles
--
-- Adds:
--   - profiles.wallet_address varchar(42)  — linked Ethereum address (nullable, unique)
--   - profiles.show_nft_in_feed boolean    — opt-in to see NFT activity in feed
--
-- Security:
--   - wallet_address stored lowercase
--   - CHECK constraint enforces 0x + 40 hex chars format
--   - Unique partial index prevents two profiles claiming the same address
--
-- Resolves: Phase 8 doc 34 (wallet integration — SIWE profile linkage)

begin;

alter table public.profiles
  add column if not exists wallet_address varchar(42),
  add column if not exists show_nft_in_feed boolean not null default false;

-- Format constraint: 0x followed by exactly 40 lowercase hex digits
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_wallet_address_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_wallet_address_format
      check (
        wallet_address is null
        or wallet_address ~ '^0x[0-9a-f]{40}$'
      );
  end if;
end$$;

-- Unique index: one address per profile; NULL values excluded (many NULL allowed)
create unique index if not exists idx_profiles_wallet_address
  on public.profiles (wallet_address)
  where wallet_address is not null;

-- Resolves: Phase 8 doc 34 (wallet_address column)

commit;
