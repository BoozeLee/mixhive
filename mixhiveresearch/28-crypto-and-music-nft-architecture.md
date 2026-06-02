# Crypto & Music NFT Architecture (Phase 7)

**"NFTs as receipts and access tokens. Not investments. Not speculation. Provenance."**

**Status:** Architecture spec — ready for Codex (schema, abstraction layer) + Claude Code (UI entry points)  
**Date:** 31 May 2026  
**Prior coverage:** None — this is the first crypto/NFT document in the research library  
**Key constraint:** Opt-in only; the entire platform works without a wallet

---

## 1. Philosophy & Positioning

### What survived the 2021–2022 music NFT cycle

The speculative wave (Mirror, Royal, Catalog in 2021–2022) crashed for predictable reasons: illiquidity, retail bag-holders, metadata stored on centralized servers, royalty splits that required ongoing legal coordination. Most platforms are gone or dormant.

What survived and is usable in 2026:

| Platform/Protocol | What it does | Why it survived |
|---|---|---|
| **Zora Protocol** | On-chain audio NFT minting on Base/Optimism | Open protocol, non-custodial, no platform lock-in, free to mint |
| **Sound.xyz** | Limited edition music drops (edition model) | Artist-centric, honest about speculative risk, well-documented SDK |
| **Manifold** | Creator-owned contracts, custom metadata | Maximum control, used by serious artists for provenance |
| **Base L2** | EVM chain by Coinbase | Low gas, Coinbase onramp, no reputational baggage |
| **Soulbound tokens (EIP-5192)** | Non-transferable tokens | Perfect for provenance/attendance receipts |

**MIXHIVE's bet:** The durably valuable use case is **provenance and access**, not financial speculation. A token that says "I was at this show" or "I backed this quest before anyone else did" is intrinsically meaningful, not extractive.

### What MIXHIVE is NOT doing

- No secondary market inside MIXHIVE
- No royalty splits or streaming revenue via tokens
- No "invest in artists" mechanics
- No required wallet for any free feature
- No on-chain storage of audio (always Supabase Storage + CDN)

---

## 2. Use Cases

Exactly three use cases, in priority order:

### 2.1 Limited Edition Mix Pass

**Problem:** Serious fans want to signal early support for a creator. Currently the only signal is "liked" (a click). There's no durable, portable proof.

**Mechanic:** After a mix is published, the creator can optionally mint a limited edition (e.g. 50 copies). Each copy:
- Costs nothing to claim (creator covers gas via Zora's gasless minting on Base)
- Is stored in the holder's wallet as an ERC-1155 token
- Unlocks in MIXHIVE: `has_early_supporter` edge in their MythicNode graph, badge on profile, access to a private collab session invite from the creator

**MythicNode integration:** When a user claims a pass, write:
- `owns_nft_of` edge: `user_profile_node → nft_collection_node`
- `has_early_supporter` edge: `user_profile_node → mix_node`

Both edges are queryable by agents — the Collab Cartographer can surface "fans who have backed your work" as high-quality collab candidates.

### 2.2 Gig/Tour Participation Proof (Soulbound)

**Problem:** DJs play gigs that are career-defining but leave no digital trace. "I played Berghain in 2024" is just a claim.

**Mechanic:** After a `performed_at` event is confirmed in the Tour Weaver flow (doc 21), the creator can auto-mint a soulbound token (EIP-5192, non-transferable) for attendees who register. The token:
- Is non-transferable (soulbound — no secondary market)
- Contains: venue name, event date, artist name, a still image
- Metadata stored on IPFS (via Zora's decentralized metadata service)

**UX:** The creator approves the gig in Tour Weaver → MIXHIVE offers "Mint participation proofs for fans who scan a QR at the door" → Each scan creates a claim link → Fan claims in one click (no wallet required to scan; wallet required to claim on-chain).

**MythicNode integration:** `attended_event` edge: `fan_profile_node → event_node` with `metadata.token_id`.

### 2.3 Mythic Quest Backing

**Problem:** Fans who believe in a creator's quest (e.g. "10 gigs in 90 days") have no way to put skin in the game or be recognized for their early faith.

**Mechanic:** A creator can enable "fan backing" on an active quest. Fans can claim a `backed_quest` token (limited supply, e.g. 20). If the quest completes, token holders receive a provenance receipt NFT automatically ("Backed this from the beginning").

**MythicNode integration:**
- `backed_by` edge: `quest_node → nft_collection_node`
- On quest completion, `quest_completed_proof` edge: `fan_profile_node → quest_node`

---

## 3. Chain and Tooling Selection

### Recommendation: Base L2 + Zora Protocol SDK

**Why Base:**
- Low gas (< $0.01 per transaction in 2026)
- Coinbase onramp: users can buy ETH via Apple Pay/Debit inside MIXHIVE without leaving the app
- No reputational baggage from 2021 speculation
- Full EVM compatibility — all Ethereum tooling works

**Why Zora Protocol:**
- Specifically designed for audio NFTs and limited editions
- Non-custodial — creator owns the contract, MIXHIVE never holds funds
- Gasless minting on Base via EIP-4337 account abstraction (creator sponsors gas)
- Well-documented TypeScript SDK: `@zoralabs/protocol-sdk`
- Fallback: use Manifold if creator wants custom contract logic

**Why NOT Ethereum mainnet:** Gas fees are unpredictable and occasionally prohibitive for a gig proof that should cost nothing to mint.

**Why NOT Solana:** Different developer ecosystem, harder to integrate with existing TypeScript/Node stack, less suitable for soulbound token standard.

### Wallet options for users

| Option | UX | Custody |
|---|---|---|
| MetaMask (browser extension) | Standard, well-known | Self-custody |
| Coinbase Wallet | Easy onboarding, integrated with Base | Self-custody |
| Privy.io (embedded wallet) | No browser extension needed; email login creates a wallet | Privy-managed (MPC) |
| No wallet | Can browse NFT content; cannot claim or mint | N/A |

**Recommendation:** Integrate Privy.io for the embedded wallet path. This lets MIXHIVE users claim NFTs without installing MetaMask — a key UX requirement for underground DJ demographics. Fall back to WalletConnect for users who prefer self-custody.

---

## 4. Data Model

### New Postgres tables

```sql
-- nft_collections: one per minted collection (per mix, per event, per quest)
CREATE TABLE IF NOT EXISTS public.nft_collections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contract_address text,               -- set after on-chain deployment
  chain            text NOT NULL DEFAULT 'base',
  token_standard   text NOT NULL DEFAULT 'ERC1155', -- or 'ERC721' for soulbound
  -- Source reference (exactly one of these is set)
  mix_id           uuid REFERENCES mixes(id),
  quest_id         uuid REFERENCES quests(id),
  event_node_id    uuid REFERENCES mythic_nodes(id),
  -- Collection config
  max_supply       int,                -- null = unlimited
  soulbound        boolean NOT NULL DEFAULT false,
  name             text NOT NULL,
  description      text,
  image_url        text,
  metadata_uri     text,               -- IPFS URI set after deploy
  -- Status
  status           text NOT NULL DEFAULT 'draft', -- draft | deploying | live | ended
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- nft_tokens: one row per minted/claimed token
CREATE TABLE IF NOT EXISTS public.nft_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   uuid NOT NULL REFERENCES nft_collections(id) ON DELETE CASCADE,
  token_id        bigint,             -- on-chain token ID
  holder_address  text,               -- wallet address of holder
  holder_profile  uuid REFERENCES profiles(id), -- if holder is a MIXHIVE user
  minted_at       timestamptz,
  tx_hash         text,
  soulbound       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON nft_collections (owner_id, status);
CREATE INDEX ON nft_collections (mix_id) WHERE mix_id IS NOT NULL;
CREATE INDEX ON nft_collections (quest_id) WHERE quest_id IS NOT NULL;
CREATE INDEX ON nft_tokens (collection_id, holder_address);
CREATE INDEX ON nft_tokens (holder_profile) WHERE holder_profile IS NOT NULL;
```

**RLS:**
- `nft_collections`: owner can read/write their own; authenticated users can read `status='live'` collections
- `nft_tokens`: service_role insert (minting is server-side); authenticated users can read tokens they hold

### MythicNode edges

Three new edge types to add to the `mythic_edges` edge_type CHECK constraint in a migration:

| Edge type | From | To | Meaning |
|---|---|---|---|
| `owns_nft_of` | artist_profile | nft_collection node | This user holds a token in this collection |
| `backed_by` | quest | nft_collection node | This quest has a backing collection |
| `backed_quest` | artist_profile | quest | This user backed this quest (via token claim) |

```sql
-- Add nft_collection as a node type
-- (Existing constraint in migration 045 allows: artist_profile, mix, buzz, event, venue, opportunity, promoter, label, curator, quest, agent)
-- Add: nft_collection
ALTER TABLE mythic_nodes DROP CONSTRAINT IF EXISTS mythic_nodes_node_type_check;
ALTER TABLE mythic_nodes ADD CONSTRAINT mythic_nodes_node_type_check
  CHECK (node_type IN (
    'artist_profile','mix','buzz','event','venue','opportunity',
    'promoter','label','curator','quest','agent','nft_collection'
  ));
```

---

## 5. Backend Abstraction Layer

MIXHIVE never talks directly to the blockchain from the frontend. All on-chain operations go through a thin server-side service. This keeps private keys off the client and allows Codex to swap chains or providers later without touching the UI.

The abstraction layer lives in `src/lib/nft-service.ts` (new file).

### API surface

```typescript
// src/lib/nft-service.ts

export interface NftCollectionConfig {
  owner_id: string;
  name: string;
  description: string;
  image_url: string;
  max_supply?: number;
  soulbound?: boolean;
  // Source
  mix_id?: string;
  quest_id?: string;
  event_node_id?: string;
}

export interface MintResult {
  token_id: number;
  tx_hash: string;
  holder_address: string;
}

// 1. Deploy a new collection (idempotent on collection_id)
export async function createNftCollection(config: NftCollectionConfig): Promise<{
  collection_id: string;
  contract_address: string;
  metadata_uri: string;
}>;

// 2. Mint a token for a holder
export async function mintToken(
  collection_id: string,
  holder_address: string
): Promise<MintResult>;

// 3. Get all current holders of a collection
export async function getTokenHolders(collection_id: string): Promise<Array<{
  holder_address: string;
  holder_profile: string | null;
  token_id: number;
  minted_at: string;
}>>;

// 4. Verify a specific user holds a token in a collection (for access gating)
export async function verifyTokenOwnership(
  profile_id: string,
  collection_id: string
): Promise<boolean>;
```

### Implementation notes

- **`createNftCollection`:** Calls Zora SDK to upload metadata to IPFS, deploys the ERC-1155 contract on Base, writes result to `nft_collections` table. Runs in a background worker (same pattern as `mythic_graph_jobs`).
- **`mintToken`:** Signs and sends the mint transaction using a MIXHIVE-controlled wallet (stored in env var `NFT_SIGNER_KEY`). Writes `nft_tokens` row on success.
- **All calls are async fire-and-forget from the user's perspective.** MIXHIVE never blocks a page load on chain confirmation. The UI shows "minting..." and updates when the `nft_tokens` row is written.
- **`NFT_SIGNER_KEY`** is a server-side env var, never exposed to the browser. Codex stores it in Vercel environment variables.

### New API routes

```
POST /api/nft/collections          — create a new collection (owner only)
POST /api/nft/collections/:id/mint — mint a token for a wallet address
GET  /api/nft/collections/:id      — get collection details + holder count
GET  /api/nft/verify               — ?collection_id=... check if caller holds a token
```

All routes require `Authorization: Bearer <supabase_jwt>`. Minting additionally checks that the caller is the collection owner or has been invited.

---

## 6. Opt-In / UX Constraints

### Hard rules

1. **No wallet required for any free feature.** Users who never touch crypto can use MIXHIVE forever without degradation.
2. **No on-chain audio.** Media (mixes, stems, covers) always lives in Supabase Storage. NFT metadata links to the CDN URL — it's a receipt, not the file.
3. **No secondary market UI.** MIXHIVE never shows floor prices, trading volumes, or "sell your token" CTAs. Token value is intrinsic (access, provenance), not financial.
4. **No forced wallet upgrade for existing features.** Features that add NFT capabilities (e.g. Mix Pass) are additive opt-in, not replacements for existing like/follow mechanics.

### Entry points in the UI (Claude Code handoff)

| Where | CTA | Action |
|---|---|---|
| Mix detail page, owner view | "Mint a limited edition pass" button (below mix stats) | Opens NftMintModal |
| Mix detail page, fan view | "Claim a pass" button (if collection exists + supply remains) | Opens wallet connect → claim flow |
| Tour Weaver gig confirmation | "Enable attendance proofs for fans" toggle | Triggers background collection creation |
| Quest detail page | "Enable fan backing" toggle (active quests only, owner only) | Triggers background collection creation |
| Profile page | "NFT passes" section (if user holds any) | Displays claimed tokens with collection name + date |

### `NftMintModal` spec (new component)

```typescript
interface NftMintModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: 'mix' | 'quest' | 'event';
  sourceId: string;
  defaultConfig?: Partial<NftCollectionConfig>;
}
```

Steps inside the modal:
1. Name the collection + set supply (default: 50)
2. Choose soulbound Y/N (gig proofs default to soulbound)
3. Preview the token metadata (name, image pulled from mix/quest)
4. "Deploy" button → fires `POST /api/nft/collections` → shows "Deploying..." spinner → redirects to collection page on success

### Wallet connect modal (Claude Code)

Use `wagmi` + `viem` for the wallet connection. Privy.io for the embedded wallet path. Keep this as a separate lazy-loaded chunk — it's a large dependency and most users will never need it.

```typescript
// src/components/WalletConnectModal.tsx
// Props: isOpen, onClose, onConnected(address: string)
// Renders: "Connect MetaMask" | "Connect Coinbase Wallet" | "Continue with email" (Privy)
```

---

## Codex Handoff

**Migration 066** (`066_nft_tables.sql`):
- `nft_collections` + `nft_tokens` tables + indexes + RLS
- Extend `mythic_nodes.node_type` CHECK constraint to include `'nft_collection'`
- Add `owns_nft_of`, `backed_by`, `backed_quest` to `mythic_edges.edge_type` CHECK constraint

**New files:**
- `src/lib/nft-service.ts` — abstraction layer (4 functions listed in section 5)
- `src/app/api/nft/collections/route.ts` — POST create
- `src/app/api/nft/collections/[id]/mint/route.ts` — POST mint
- `src/app/api/nft/collections/[id]/route.ts` — GET details
- `src/app/api/nft/verify/route.ts` — GET ownership check

**Environment variable:** `NFT_SIGNER_KEY` — add to Vercel environment (server-side only, never `NEXT_PUBLIC_`)

## Claude Code Handoff

- `src/components/NftMintModal.tsx` — new component (spec in section 6)
- `src/components/WalletConnectModal.tsx` — new component (spec in section 6)
- `src/views/MixDetail.tsx` — add "Mint pass" / "Claim pass" CTA below mix stats
- `src/views/QuestDetail.tsx` — add "Enable fan backing" toggle
- `src/views/EnhancedProfilePage.tsx` — add "NFT passes" section to profile

**Dependencies to add (lazy-loaded):**
- `wagmi` + `viem` — wallet connection
- `@privy-io/react-auth` — embedded wallet
- `@zoralabs/protocol-sdk` — minting (server-side only, never in the browser bundle)

---

## Phase 9 Upgrade Paths

| Capability | Description | Trigger |
|---|---|---|
| Royalty splits | EIP-2981 royalty receiver — creator gets % of secondary sales | When secondary volume justifies legal structure |
| Fan ownership tiers | ERC-20 micro-ownership of a mix's streaming revenue | Regulatory clarity in Belgium/EU |
| IPFS pinning SLA | Migrate from Zora's default IPFS to dedicated Filecoin deal | When collection count exceeds 1,000 |
| Soulbound attestations (EAS) | Ethereum Attestation Service for provenance claims | When interoperability with external career credentials matters |
| Cross-platform graph import | Import owned tokens from Sound.xyz / Zora into MIXHIVE MythicNode | When token holders want unified career graph |
