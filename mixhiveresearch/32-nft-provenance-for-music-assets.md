# Doc 32 — NFT Provenance for Music Assets

Phase 8 infra spec. Extends doc 28 (NFT architecture). Codex + Claude Code implementation handoff.

Doc 28 covers: philosophy, chain selection (Base L2 + Zora SDK), 3 use cases, `nft_collections` /
`nft_tokens` schema, backend abstraction layer, and UX constraints.

This doc covers: creator ownership governance, multi-creator attribution, on-chain ↔ DB sync
architecture, provenance receipt format, and MythicNode edge flows per use case.

---

## 1. Creator-Ownership Guarantees

The central principle: **no token exists without creator consent**. Every mint requires explicit
authorisation from the creator (or all co-creators in a collab case).

### 1.1 Authorisation Rules

| Scenario | Who can initiate a mint |
|---|---|
| Solo mix or solo quest | `nft_collections.owner_id` only |
| Collab mix (multiple creators) | Any listed co-creator, but only after all co-creators have accepted |
| Soulbound gig proof | System (service role) after `performed_at` event is confirmed |
| Admin override | Not permitted — no admin bypass for creator consent |

**Acceptance tracking for collab collections:**

```sql
-- Add to nft_collections table via migration
co_creator_approvals JSONB DEFAULT '[]'
-- Shape: [{ profile_id: UUID, approved: bool, approved_at: ISO8601 }]
```

A mint is blocked unless `co_creator_approvals` contains an entry with `approved: true` for
every profile in `props.co_creators`. The mint route checks this before inserting `nft_tokens`.

### 1.2 Soulbound Token Constraints

Soulbound tokens (`nft_tokens.soulbound = true`) are enforced at two levels:

1. **Contract level:** MIXHIVE deploys collections using ERC-5192 (Minimal Soulbound NFT
   standard). The `locked()` function returns `true` for all soulbound tokens; any transfer
   call reverts on-chain.

2. **Application level:** When the `/api/cron/nft-sync` job processes `Transfer` events, it
   checks if `nft_tokens.soulbound = true`. If a transfer event arrives for a soulbound token
   (which should not be possible, but may occur due to chain reorganisations), it logs a
   warning and does NOT update `holder_address`.

### 1.3 Collection Status Flow

```
draft → deploying → live → paused (optional) → ended
```

- `draft`: created in DB, no contract deployed yet.
- `deploying`: `POST /api/nft/collections` sets this; Zora SDK call queued (async worker).
- `live`: contract confirmed on Base L2; `contract_address` set.
- `paused`: owner has temporarily halted new claims (no new `nft_tokens` inserts allowed).
- `ended`: supply exhausted or owner closed collection.

---

## 2. Multi-Creator Attribution Model

For mixes produced in a collab session, multiple creators share provenance and optionally
on-chain royalties.

### 2.1 Co-Creators in JSONB

`nft_collections.props.co_creators` is an array of creator objects:

```json
{
  "co_creators": [
    {
      "profile_id": "uuid-of-creator-a",
      "wallet_address": "0x...",
      "royalty_share_bps": 5000
    },
    {
      "profile_id": "uuid-of-creator-b",
      "wallet_address": "0x...",
      "royalty_share_bps": 5000
    }
  ]
}
```

`royalty_share_bps` is in basis points (100 = 1%; total must sum to 10000). These are passed
to Zora's `SplitMain` contract at collection deployment time, enabling automatic on-chain
royalty distribution.

### 2.2 MythicNode `created_by` Edges

When an `nft_collection` node is created, a `created_by` edge is inserted for each co-creator:

```sql
INSERT INTO mythic_edges (from_node_id, to_node_id, edge_type, props)
SELECT
  artist_node.id,
  nft_node.id,
  'created_by',
  jsonb_build_object(
    'royalty_share_bps', co_creator->>'royalty_share_bps',
    'collab_session_id', :session_id
  )
FROM jsonb_array_elements(collection.props->'co_creators') AS co_creator
JOIN mythic_nodes artist_node
  ON artist_node.external_id = (co_creator->>'profile_id')::uuid
  AND artist_node.node_type = 'artist_profile'
JOIN mythic_nodes nft_node
  ON nft_node.external_id = collection.id
  AND nft_node.node_type = 'nft_collection';
```

This query is executed by the `POST /api/nft/collections` route after inserting the
`nft_collections` row and its corresponding `mythic_nodes` entry.

### 2.3 Zora SplitMain Integration

`SplitMain` is a Zora/0xSplits contract on Base L2. When deploying a collection:

```typescript
// server-side only, in /api/nft/collections POST handler
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

// Build split recipients from co_creators
const recipients = coCreators.map(c => ({
  address: c.wallet_address as `0x${string}`,
  percentAllocation: c.royalty_share_bps / 100,  // SplitMain uses percent, not bps
}));

// Deploy split contract (returns splitAddress)
// Then deploy Zora collection with royaltyRecipient = splitAddress
```

The `splitAddress` is stored in `nft_collections.props.split_contract_address`.

This is Codex infrastructure; Claude Code does not touch contract deployment.

---

## 3. On-Chain ↔ DB Sync Architecture

MIXHIVE uses an optimistic write + async confirmation pattern. The DB is always the primary
source of truth for the application; on-chain events confirm or correct the DB state.

### 3.1 Optimistic Write Flow

```
User claims a pass →
  POST /api/nft/collections/:id/mint →
    INSERT nft_tokens (status: 'pending_mint') →
      Queue async worker (NFT_SIGNER_KEY) →
        Worker calls Zora SDK mint() →
          On-chain confirmation emitted →
            /api/cron/nft-sync picks up Transfer event →
              UPDATE nft_tokens SET tx_hash, status='confirmed', token_id
```

### 3.2 `/api/cron/nft-sync` Vercel Cron Route

Schedule: every hour (`0 * * * *` in `vercel.json` crons).

Algorithm:

```typescript
export async function GET() {
  // 1. Fetch all live collections with a sync_cursor
  const collections = await supabase
    .from('nft_collections')
    .select('id, contract_address, sync_cursor, chain')
    .eq('status', 'live');

  for (const collection of collections) {
    // 2. Query Zora API for Transfer events since sync_cursor
    const events = await zoraClient.getTransferEvents({
      contractAddress: collection.contract_address,
      fromBlock: collection.sync_cursor ?? 0,
    });

    for (const event of events) {
      // 3. Update nft_tokens.holder_address for existing tokens
      // 4. Insert new nft_tokens rows for previously unknown mints
      // 5. Update owns_nft_of MythicNode edges
      await syncTransferEvent(collection.id, event);
    }

    // 6. Advance sync_cursor to latest block processed
    await supabase
      .from('nft_collections')
      .update({ sync_cursor: events.latestBlock })
      .eq('id', collection.id);
  }
}
```

The `sync_cursor` column (block number, bigint) is added to `nft_collections` in the Phase 8
migration.

### 3.3 Error Handling

- If Zora API is unreachable, log to `agent_events` (`event_type: 'nft_sync_error'`) and skip
  this collection until the next cron run. Never fail the cron for one bad collection.
- If a `Transfer` event arrives for a soulbound token, log a warning and do not update `holder_address`.
- If `sync_cursor` is NULL (first sync), start from block 0 (full scan from contract deployment).

---

## 4. Provenance Receipt Format

A provenance receipt is a permanent, human-readable record of who created what, when, and
for whom. Stored in `nft_tokens.props.provenance_receipt`.

```json
{
  "mix_id": "uuid-of-mix",
  "collection_id": "uuid-of-collection",
  "token_id": 42,
  "chain": "base",
  "contract_address": "0x...",
  "tx_hash": "0x...",
  "minted_at": "2026-06-01T12:00:00Z",
  "creator_profiles": [
    { "profile_id": "uuid-a", "display_name": "DJ Nef", "royalty_share_bps": 7000 },
    { "profile_id": "uuid-b", "display_name": "Speedy J", "royalty_share_bps": 3000 }
  ],
  "collab_session_id": "uuid-of-session",
  "edition_name": "Bunker Sessions Vol. 1",
  "soulbound": false
}
```

**Public receipt URL:** `https://mixhive.app/nft/{collection_id}/{token_id}`

This route renders a public page (no auth required) showing: creator names, mix title, mint
date, token number, chain badge ("Base L2"), and a link to verify on BaseScan. This URL is
what fans share as social proof ("I have pass #42 of Bunker Sessions Vol. 1").

Claude Code task: create `src/app/nft/[collectionId]/[tokenId]/page.tsx` as a static-friendly
public route using `generateStaticParams` for known tokens.

---

## 5. MythicNode Edges Created Per Use Case

Extending doc 28's 3 use cases with precise edge specifications.

### Use Case 1: Limited Edition Mix Pass

Triggered by: fan clicks "Claim a pass" on a live collection.

Edges created/updated:

| Edge | from | to | When |
|---|---|---|---|
| `owns_nft_of` | fan `artist_profile` node | `nft_collection` node | On DB insert of `nft_tokens` |
| `has_early_supporter` | fan `artist_profile` node | creator `artist_profile` node | On DB insert, if `nft_collections.props.grants_early_supporter = true` |

`owns_nft_of` edge `props`: `{ token_id: UUID, token_number: int, minted_at: ISO8601 }`

### Use Case 2: Soulbound Gig Proof

Triggered by: `POST /api/mythic/log-performance` confirms a `performed_at` event.

Edges created:

| Edge | from | to | When |
|---|---|---|---|
| `attended_event` | fan `artist_profile` node | event `mythic_node` | Immediately on confirmation |
| `owns_nft_of` | fan `artist_profile` node | `nft_collection` node | After async mint confirmation |

Note: "fan" here means any profile that the gig log creator marks as an attendee. Initially
this is the creator themselves (proof of their own performance). Fan claim flow for ticket-holder
proofs is a future Phase 9 feature.

### Use Case 3: Quest Backing

Triggered by: fan clicks "Back this quest" on an active quest with a live backing collection.

Edges created:

| Edge | from | to | When |
|---|---|---|---|
| `backed_quest` | fan `artist_profile` node | `quest` mythic_node | On DB insert of backing token |
| `backed_by` | `quest` mythic_node | `nft_collection` node | Created once when collection is linked to quest |

On quest completion (all milestones done):

| Edge | from | to | When |
|---|---|---|---|
| `received_provenance_receipt` | fan `artist_profile` node | `mix` mythic_node | Triggered by quest completion webhook/trigger |

---

## 6. Ethical + Practical Constraints

These constraints are architectural requirements, not optional guidelines.

1. **No secondary market UI.** MIXHIVE never shows buy/sell/trade flows. Token transfers
   happen on-chain; MIXHIVE only syncs and displays ownership. No "list for sale" button.

2. **No price display.** Floor price, last sale price, estimated value — none of these fields
   exist in the schema or appear in any UI component.

3. **No speculative framing in copy.** Marketing copy for NFT features must not use language
   suggesting financial returns, scarcity for speculation, or FOMO. Approved language: "access",
   "proof", "support", "backing". Prohibited: "investment", "value", "rare", "exclusive drop".

4. **Media always on Supabase Storage / CDN.** Mix audio, artwork images, and stems are stored
   on Supabase Storage. Only the metadata JSON (name, description, image IPFS URI) is on IPFS
   via Zora. Audio is never uploaded to IPFS.

5. **Gas covered by MIXHIVE for soulbound tokens.** For the gig proof use case, MIXHIVE pays
   the Base L2 gas (negligible: ~$0.001 per mint at current Base fees). Creators and fans pay
   nothing for soulbound claims. For transferable mix passes, creator deploys the contract
   (one-time gas cost) and claims are gasless via Zora's gasless claim flow.

6. **Opt-out is always available.** Any creator can delete their `nft_collections` row
   (soft-delete: `status = 'ended'`). On-chain tokens already minted are permanent (by design —
   that is the point of provenance), but no new tokens can be minted.

---

## 7. Codex Handoff

**Migration (e.g. 069):**

```sql
-- Add sync_cursor to nft_collections
ALTER TABLE nft_collections
  ADD COLUMN IF NOT EXISTS sync_cursor BIGINT,
  ADD COLUMN IF NOT EXISTS co_creator_approvals JSONB NOT NULL DEFAULT '[]';

-- Index for efficient sync loop
CREATE INDEX IF NOT EXISTS idx_nft_collections_live
  ON nft_collections (status)
  WHERE status = 'live';
```

**New API routes:**
- `POST /api/nft/collections/:id/approve` — co-creator approval endpoint. Validates caller is
  a listed co-creator, sets `co_creator_approvals[].approved = true` for their entry.
  If all approvals are complete, transitions collection to `live` (or `deploying` if contract
  not yet deployed).
- `GET /api/nft/collections/:id/receipt/:tokenId` — returns provenance receipt JSON for the
  public receipt page.
- `/api/cron/nft-sync` — hourly cron route as described in §3.2.

**Claude Code handoff:**
- `src/app/nft/[collectionId]/[tokenId]/page.tsx` — public provenance receipt page.
- Co-creator approval banner on `NftMintModal` step 1: if collection has co-creators who
  haven't approved yet, show "Waiting for co-creator approval: [names]" and disable "Deploy".
