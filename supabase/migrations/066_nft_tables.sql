-- Migration 066: nft_collections, nft_tokens, graph extensions for NFT provenance
--
-- Adds tables for the MIXHIVE NFT layer (doc 28): limited edition mix passes,
-- soulbound gig participation proofs, and quest backing tokens.  Chain: Base L2
-- via Zora Protocol SDK.  MIXHIVE never stores audio on-chain; tokens are
-- receipts and access keys only.  All blockchain calls are server-side;
-- NFT_SIGNER_KEY must be set as a server-only Vercel env var.
--
-- Extends mythic_nodes.node_type with 'nft_collection' and
-- mythic_edges.edge_type with 'owns_nft_of', 'backed_by', 'backed_quest'.
--
-- Resolves: Phase 7 — doc 28 (crypto/NFT architecture)

begin;

-- ── 1. nft_collections ──────────────────────────────────────────────────────

create table if not exists public.nft_collections (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references profiles(id) on delete cascade,
  contract_address text,
  chain            text not null default 'base',
  token_standard   text not null default 'ERC1155',

  -- Source reference: exactly one of these is set
  mix_id           uuid references mixes(id),
  quest_id         uuid references quests(id),
  event_node_id    uuid references mythic_nodes(id),

  max_supply       int,
  soulbound        boolean not null default false,
  name             text not null,
  description      text,
  image_url        text,
  metadata_uri     text,

  status           text not null default 'draft'
    check (status in ('draft', 'deploying', 'live', 'ended')),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_nft_collections_owner_status
  on nft_collections (owner_id, status);

create index if not exists idx_nft_collections_mix_id
  on nft_collections (mix_id)
  where mix_id is not null;

create index if not exists idx_nft_collections_quest_id
  on nft_collections (quest_id)
  where quest_id is not null;

alter table nft_collections enable row level security;

drop policy if exists "Owners manage their collections" on nft_collections;
create policy "Owners manage their collections"
  on nft_collections for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Anyone can read live collections" on nft_collections;
create policy "Anyone can read live collections"
  on nft_collections for select
  using (status = 'live');

-- ── 2. nft_tokens ───────────────────────────────────────────────────────────

create table if not exists public.nft_tokens (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references nft_collections(id) on delete cascade,
  token_id        bigint,
  holder_address  text,
  holder_profile  uuid references profiles(id),
  minted_at       timestamptz,
  tx_hash         text,
  soulbound       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_nft_tokens_collection_holder
  on nft_tokens (collection_id, holder_address);

create index if not exists idx_nft_tokens_holder_profile
  on nft_tokens (holder_profile)
  where holder_profile is not null;

alter table nft_tokens enable row level security;

-- Inserts are service_role only (minting is server-side)
drop policy if exists "Holders can read their tokens" on nft_tokens;
create policy "Holders can read their tokens"
  on nft_tokens for select
  using (holder_profile = auth.uid());

-- ── 3. Extend mythic_nodes.node_type to include 'nft_collection' ───────────

alter table mythic_nodes drop constraint if exists mythic_nodes_node_type_check;
alter table mythic_nodes add constraint mythic_nodes_node_type_check
  check (node_type in (
    'artist_profile',
    'mix',
    'buzz',
    'event',
    'venue',
    'opportunity',
    'promoter',
    'label',
    'curator',
    'quest',
    'agent',
    'collab_session',
    'nft_collection'
  ));

-- ── 4. Extend mythic_edges.edge_type with NFT provenance edges ─────────────

alter table mythic_edges drop constraint if exists mythic_edges_edge_type_check;
alter table mythic_edges add constraint mythic_edges_edge_type_check
  check (edge_type in (
    'performed_at',
    'booked_by',
    'submitted_to',
    'collab_with',
    'remixed',
    'engaged_with',
    'recommended_by_agent',
    'followed',
    'inspired_by',
    'quest_milestone',
    'yielded_outcome',
    'similar_artist',
    'session_produced_mix',
    'owns_nft_of',
    'backed_by',
    'backed_quest'
  ));

commit;

-- Resolves: Phase 7 doc 28 (nft_collections + nft_tokens + graph extensions)
