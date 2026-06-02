-- Migration 068: Phase 8 — NFT provenance extensions
--
-- Extends nft_collections with:
--   - sync_cursor bigint   (block number for on-chain event sync)
--   - co_creator_approvals jsonb (per-co-creator mint consent tracking)
--   - 'paused' status option
--
-- Adds:
--   - idx_nft_collections_live for efficient sync loop
--
-- Resolves: Phase 8 doc 32 (NFT provenance — creator ownership governance + sync)

begin;

-- Add sync_cursor for on-chain Transfer event polling
alter table public.nft_collections
  add column if not exists sync_cursor bigint,
  add column if not exists co_creator_approvals jsonb not null default '[]';

-- Extend status CHECK to include 'paused'
alter table public.nft_collections
  drop constraint if exists nft_collections_status_check;

alter table public.nft_collections
  add constraint nft_collections_status_check
  check (status in ('draft', 'deploying', 'live', 'paused', 'ended'));

-- Partial index for efficient sync loop — only live collections need syncing
create index if not exists idx_nft_collections_live
  on public.nft_collections (owner_id)
  where status = 'live';

-- Index for sync cursor queries
create index if not exists idx_nft_collections_sync
  on public.nft_collections (sync_cursor)
  where status = 'live' and sync_cursor is not null;

-- Resolves: Phase 8 doc 32 (nft_collections governance)

commit;
