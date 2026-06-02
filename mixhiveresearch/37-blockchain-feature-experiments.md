# Doc 37: Blockchain Feature Experiments

> **Phase 9 — Blockchain Integration & Experiments**
>
> Docs 28 and 32 describe the three NFT use cases for MIXHIVE (mix pass,
> soulbound gig proof, quest backing). This document specifies HOW to ship each
> as a measurable experiment — with concrete success criteria, instrumentation,
> rollout gates, and kill-switch procedures.
>
> **Does NOT duplicate:** doc 28 (use case descriptions, data model),
> doc 32 (creator governance, provenance receipt format, sync architecture),
> doc 26 (general A/B framework and `experiment_events` schema).

---

## 0. Shared Prerequisites

All three experiments depend on:

1. `WEB3_EXPERIMENTS_ENABLED=true` environment variable (see doc 35 §4.2)
2. Migration 072 applied (`wallet_links`, `profiles.web3_tier`)
3. `/api/cron/nft-sync` running hourly (see doc 36 §3)
4. `nft-service.ts` implemented (see doc 36 §1)

**Rollout order:** Experiment 2 (Soulbound Gig Proof) should launch last — it
requires the most operational trust (auto-minting from an agent trigger). Run
Experiments 1 and 3 first to establish baseline reliability.

Recommended launch sequence:
- Week 1: Enable Experiment 1 for opted-in beta creators
- Week 3: Enable Experiment 3 for opted-in creators with active quests
- Week 6: Enable Experiment 2 after sync reliability confirmed ≥99.5%

---

## 1. Experiment 1 — Early-Supporter Mix Pass Drop

### 1.1 What

A creator mints up to 100 edition passes tied to a specific mix. Fans who claim
a pass receive:
- `has_early_supporter` MythicNode edge from their profile node to the creator's
  profile node
- A private collab session invite (unlocked by `GET /api/nft/verify` returning
  `true` for the collection)
- A persistent "Early Supporter" badge on the mix detail page

No price. No secondary market. No financial framing.

### 1.2 Integration Points

**Mix detail page (`src/views/MixDetail.tsx`):**
- Fetch: `GET /api/nft/collections?source_type=mix&source_id={mixId}` to check if
  a collection exists for this mix
- If `status='live'` and `max_supply > 0`:
  - Show supply counter: "14 of 100 supporters"
  - Check if current user holds a pass: `GET /api/nft/verify?collection_id={id}`
  - If not held: show "Support this release" CTA → opens `NftClaimModal`
  - If held: show "You're an early supporter ✓"
- If no collection and current user is the creator: show "Create supporter pass"
  CTA → opens `NftMintModal` pre-filled with `sourceType='mix'`

**New modal: `NftClaimModal.tsx`:**
- Displays: collection name, supply remaining, perks list ("Private collab invite,
  Early supporter badge")
- CTA: "Claim for free" — no price
- On confirm: `POST /api/nft/collections/[id]/mint` with `holderAddress` from
  connected wallet
- On success: show confetti + "You're an early supporter. Check your inbox for
  a collab invite." → fires `experiment_events` row `web3_token_claimed`

**API changes:**
- `GET /api/nft/collections` — add `?source_type=&source_id=` query params
- `GET /api/nft/collections/[id]` — add `holder_count` field to response

### 1.3 Required Data

| Table | Action |
|---|---|
| `nft_collections` | 1 row per mix pass collection |
| `nft_tokens` | 1 row per claim |
| `mythic_edges` | `owns_nft_of` (fan → collection) + `has_early_supporter` (fan → creator profile) |

**`has_early_supporter` edge creation:**
Created by the `/api/nft/collections/[id]/mint` route after successful mint,
using the creator's `artist_profile` node as `to_node_id`.

### 1.4 UX Requirements

- CTA text: **"Support this release"** — never "Mint", "Buy", "Purchase"
- Supply display: **"14 of 100 supporters"** — no price anywhere
- Post-claim: **"You're an early supporter"** — not "You own 1 token"
- If wallet not connected: show "Connect your wallet to support" — not "You need
  a wallet to buy this"
- Error state (supply exhausted): "This release has reached its full supporter
  count. Follow the creator to hear about future drops."

### 1.5 Agent Proposal Trigger (Scene Navigator)

See doc 38 §3 for full Lua behavior. Summary:
- Condition: `top_mix_plays > 500` AND no active collection for that mix
- Proposal action: `create_pass` with `estimated_supply=50`
- Throttle: max 1 proposal per mix per 30 days

### 1.6 Metrics

**Primary:**
- `collections_created_per_week` — count of new `nft_collections` with `source_type='mix'`
- `claim_rate` — `count(nft_tokens where collection_id = X) / max_supply`

**Secondary:**
- `has_early_supporter_edges_created` — MythicNode graph enrichment rate
- `collab_sessions_from_pass_holders` — downstream metric: did pass holders start
  collab sessions with the creator within 30 days?
- `proposal_acceptance_rate` — of agent `create_pass` proposals shown, how many
  creators actually created a collection?

**Guardrails (block experiment if exceeded):**
- Core feature usage must not drop >5% vs pre-experiment cohort
- Zero compliance flags in the first 2 weeks (monitored by text search on
  user-submitted collection names for banned financial language)

### 1.7 Success Criteria

| Metric | Target after 4 weeks |
|---|---|
| Collections created | ≥ 3 by independent creators |
| Average claim rate | ≥ 20% of max_supply |
| Downstream collab sessions | ≥ 1 collab session per creator who minted |
| Compliance flags | 0 |
| Collection deployment success rate | ≥ 95% (status='live' within 30s of API call) |

**Failure definition:** If zero collections are created within 4 weeks of
`WEB3_EXPERIMENTS_ENABLED=true`, pause the experiment and run a creator survey.

### 1.8 Kill Switch

1. Set `WEB3_EXPERIMENTS_ENABLED=false`
2. `POST /api/nft/collections` returns 503
3. "Support this release" CTA hidden on mix detail (checked at render time)
4. Existing collections and tokens remain; `GET /api/nft/verify` still works
5. Collab session access for pass holders continues to work

---

## 2. Experiment 2 — Soulbound Gig-Proof Token

### 2.1 What

After a creator confirms a `performed_at` gig event via Tour Weaver, MIXHIVE
auto-mints a soulbound ERC-5192 token for each attendee who has linked a wallet.
The token is a permanent, non-transferable proof of "I was at this show."

No claim UI required — the mint is automatic and fan-driven only by having a
linked wallet.

### 2.2 Integration Points

**Trigger:** `performed_at` edge creation in `mythic_edges` (via Tour Weaver
`POST /api/mythic/events` when creator marks a gig as confirmed).

The trigger fires a background job that:
1. Finds all attendees listed on the event who have `wallet_links` rows
2. Calls `nft-service.createCollection` with `soulbound=true`, `source_type='event'`
3. For each attendee with a wallet: calls `nft-service.mintToken` with
   `holderAddress` from their embedded or external wallet

**Notification (existing `notifications` table):**
After mint confirmed by sync cron:
- Insert notification: `type='gig_proof_minted'`, `payload={ collection_id, token_id }`
- Message: "Your gig proof for [Event Name] is being minted"
- After sync confirms: "Your gig proof is ready. View your receipt →"

**Profile page:**
- New "Gig Proofs" section in creator and fan profiles showing soulbound tokens
- Each card: event name, venue, date, "View receipt" link → `/nft/{collectionId}/{tokenId}`

### 2.3 Attendee Tracking Prerequisite

Experiment 2 requires knowing who attended an event. In Phase 9, this is manual:
the creator lists attendees when confirming the gig in Tour Weaver. Future
automation (QR code check-in, ticket partner API) is Phase 10.

Creator flow: after logging a gig, "Tag attendees" step — search MIXHIVE users
to add as confirmed attendees. Each added attendee who has a `wallet_links` row
gets a mint queued.

### 2.4 Required Data

| Table | Action |
|---|---|
| `nft_collections` | 1 per confirmed gig event (soulbound=true) |
| `nft_tokens` | 1 per attendee with linked wallet |
| `mythic_edges` | `attended_event` (fan → event node) + `owns_nft_of` (fan → collection) |

### 2.5 UX Requirements

- No claim CTA — fan is passive recipient
- Notification copy: "Your proof of attendance for [Event] is on its way" (not "Your
  NFT is minting")
- Profile display: "Gig proof: [Event Name] — [Venue] — [Date]"
- If fan has no wallet: no notification; show "Connect a wallet in Settings to
  receive proof of attendance for future shows you're tagged in"

### 2.6 Metrics

**Primary:**
- `gig_proofs_minted_per_week` — count of `nft_tokens` with soulbound collections
- `wallet_linkup_rate` — % of attendees tagged in a gig who have a `wallet_links` row

**Secondary:**
- `follow_or_collab_post_proof` — did fan follow or collab with creator within
  7 days of receiving gig proof?
- `embedded_wallet_activations_per_gig` — new wallet links triggered by gig
  proof notification (fan receives notification, clicks "Connect wallet")

**Guardrails:**
- Sync reliability: `nft_tokens.status='minted'` within 1 hour of mint initiation
  for ≥95% of tokens
- Zero failed mints left in `status='failed'` for >24 hours without retry

### 2.7 Success Criteria

| Metric | Target after 6 weeks |
|---|---|
| Gig proofs minted | ≥ 5 separate events with proofs issued |
| Wallet linkup rate | ≥ 40% of tagged attendees |
| Sync reliability | ≥ 95% confirmed within 1 hour |
| Post-proof engagement | ≥ 25% of proof holders follow or interact with creator |

### 2.8 Kill Switch

Setting `WEB3_EXPERIMENTS_ENABLED=false` suppresses the auto-mint trigger.
Pending gig proofs in `status='pending'` are paused — not dropped. They resume
when the flag is re-enabled. Creator is notified of the pause via dashboard alert.

---

## 3. Experiment 3 — Quest-Backing NFT Pass

### 3.1 What

Fans can back a creator's active quest by claiming a token. If the quest reaches
completion (all milestones done), each backer's token is updated with a provenance
receipt. The receipt is a public URL at `/nft/{collectionId}/{tokenId}`.

Unlike a mix pass, the quest-backing token is forward-looking: fans are backing
an outcome, not an existing artifact.

### 3.2 Integration Points

**Quest detail page (`src/views/QuestDetail.tsx`):**
- If quest is active and has a backing collection: show backer count
  ("8 backers"), "Support this quest" CTA → opens `NftClaimModal`
- If quest is active and no backing collection: creator sees
  "Open quest for backing" CTA → opens `NftMintModal` with `sourceType='quest'`
- If quest is completed: show "This quest was completed by its backers" +
  provenance receipt link for the connected user if they're a backer

**Provenance receipt page (`src/app/nft/[collectionId]/[tokenId]/page.tsx`):**

```typescript
// Public page — no authentication required
// Displays:
// - Mix or quest title
// - Creator profile card
// - Collab session participants (if quest was born from a session)
// - Token ID, chain, contract address, tx hash
// - "Minted on Base · Powered by Zora"
// NOT displayed: price, value, floor, market
```

**Quest completion hook:**
When all `quest_milestones` reach `status='completed'`, the existing quest update
route fires a background job:
1. Fetches all `nft_tokens` for the quest's backing collection
2. For each token: writes provenance receipt to `nft_tokens.props.provenance_receipt`
3. Fires notification to each backer: "Quest complete! Your receipt is ready →"

### 3.3 Required Data

| Table | Action |
|---|---|
| `nft_collections` | 1 per quest backing collection |
| `nft_tokens` | 1 per backer |
| `mythic_edges` | `backed_quest` (fan → quest) + `backed_by` (quest → collection) + `received_provenance_receipt` (fan → mix/quest on completion) |
| `nft_tokens.props` | `provenance_receipt` JSONB added on quest completion |

**Provenance receipt JSONB** (stored in `nft_tokens.props.provenance_receipt`):
```json
{
  "quest_id": "...",
  "quest_title": "...",
  "collection_id": "...",
  "token_id": "42",
  "chain": "base",
  "contract_address": "0x...",
  "tx_hash": "0x...",
  "completed_at": "2026-09-01T12:00:00Z",
  "creator_profile_id": "...",
  "creator_username": "...",
  "collab_session_id": "..."
}
```

### 3.4 UX Requirements

- CTA: **"Support this quest"** — never "Back", "Invest", "Fund"
- Backer count: **"8 backers"** — not "8 investors" or "8 holders"
- Post-backing: **"You're backing this quest"** + progress bar showing milestone completion
- Receipt page: plain language — "You backed this quest. It was completed on [date]."
- If quest fails/is abandoned: "This quest was paused. Your backing token remains
  as a record of your support." No refund language.

### 3.5 Agent Proposal Trigger (Collab Cartographer)

See doc 38 §3. Summary:
- Condition: quest has ≥5 followers who have `follows` edges to the creator AND no
  backing collection yet
- Proposal: `open_quest_backing` with context "8 followers are engaged with this quest"
- Throttle: max 1 proposal per quest per 30 days

### 3.6 Metrics

**Primary:**
- `quest_backing_rate` — % of active quests that have ≥1 backer
- `quest_completion_rate_backed_vs_unbacked` — do backed quests complete at a
  higher rate? (cohort split: quests with backing collection vs quests without)

**Secondary:**
- `provenance_receipts_shared` — count of receipt page views from external
  referrers (social shares)
- `backer_follow_rate` — % of backers who follow the creator after backing

**Guardrails:**
- Quest detail page load time must not increase >200ms vs pre-experiment baseline
  (due to additional `GET /api/nft/collections` call on page load)
- No abandoned quests with outstanding backers without a creator notification
  ("Notify backers" step required before marking quest abandoned)

### 3.7 Success Criteria

| Metric | Target after 6 weeks |
|---|---|
| Quests with ≥1 backer | ≥ 5 |
| Average backers per backed quest | ≥ 3 |
| Quest completion rate (backed) | ≥ 10 percentage points above unbacked rate |
| Provenance receipts issued | ≥ 10 (requires ≥2 quests to complete) |
| Receipt page external shares | ≥ 5 |

### 3.8 Kill Switch

Same as Experiment 1. "Support this quest" CTA hidden. Existing backing tokens
and receipt pages continue to work.

---

## 4. Experiment Instrumentation

### 4.1 `experiment_events` Schema for Web3

All web3 experiment events use `feature = 'web3_experiment'` in the existing
`experiment_events` table. The `variant` field distinguishes experiments:

| `event_type` | `variant` | Trigger |
|---|---|---|
| `web3_pass_cta_shown` | `mix_pass` | Mix detail page rendered with pass CTA |
| `web3_pass_cta_clicked` | `mix_pass` | User clicks "Support this release" |
| `web3_collection_created` | `mix_pass` | `POST /api/nft/collections` 201 response |
| `web3_token_claimed` | `mix_pass` | `nft_tokens` row confirmed minted |
| `web3_pass_cta_shown` | `quest_backing` | Quest detail page rendered with backing CTA |
| `web3_token_claimed` | `quest_backing` | Quest backer token confirmed |
| `web3_gig_proof_queued` | `gig_proof` | Background job queued after `performed_at` edge |
| `web3_gig_proof_minted` | `gig_proof` | `nft_tokens` row confirmed minted |
| `web3_proposal_shown` | `<agent_id>` | Agent proposal surfaced in Agent Inbox |
| `web3_proposal_accepted` | `<agent_id>` | User acts on proposal |
| `web3_proposal_dismissed` | `<agent_id>` | User dismisses proposal |

### 4.2 Properties Shape

All web3 experiment events include:

```typescript
{
  feature: 'web3_experiment',
  variant: 'mix_pass' | 'quest_backing' | 'gig_proof' | string, // agent_id for proposals
  properties: {
    source_type: 'mix' | 'quest' | 'event',
    source_id: string,
    collection_id?: string,
    token_id?: string,
    wallet_type?: 'embedded' | 'external',
    agent_id?: string,        // set for proposal events
  }
}
```

### 4.3 Instrumentation Points

**In API routes (server-side, fire-and-forget):**
```typescript
// After successful mint
await supabase.from('experiment_events').insert({
  profile_id: userId,
  event_type: 'web3_token_claimed',
  feature: 'web3_experiment',
  variant: sourceType, // 'mix_pass' | 'quest_backing'
  properties: { source_type, source_id, collection_id, wallet_type },
});
// Do not await — fire and forget
```

**In React components (client-side, via `trackEvent` from `src/lib/experiments.ts`):**
```typescript
// On CTA render
trackEvent('web3_pass_cta_shown', {
  feature: 'web3_experiment',
  variant: 'mix_pass',
  properties: { source_type: 'mix', source_id: mixId, collection_id },
});
```

### 4.4 Analysis Approach

**Funnel analysis (Experiment 1):**
```
web3_pass_cta_shown
  → web3_pass_cta_clicked        (CTR)
  → web3_collection_created      (creator conversion)
  → web3_token_claimed           (fan conversion)
```

**Cohort comparison (Experiment 3):**
Split all active quests (created in the experiment window) into:
- `treatment`: quests with at least 1 web3 backing token
- `control`: quests without backing collection

Compare `quest_completion_rate` at 30 and 60 days.
Use chi-squared test (binary: completed Y/N). Minimum 20 quests per arm.

**Guardrail monitoring:**
Weekly automated check: if any guardrail metric (page load time, feature usage
rate) regresses by >5% in the experiment cohort vs. pre-experiment baseline,
send alert and pause experiment.

---

## 5. Shared Kill Switch Reference

**Global flag:** `WEB3_EXPERIMENTS_ENABLED=true|false`

| Component | Behavior when `false` |
|---|---|
| `POST /api/nft/collections` | Returns 503 `{ error: 'web3_disabled' }` |
| `POST /api/nft/collections/[id]/mint` | Returns 503 |
| Mix detail "Support" CTA | Hidden |
| Quest detail "Support quest" CTA | Hidden |
| Gig proof auto-mint trigger | Suppressed; queued mints paused |
| `/api/cron/nft-sync` | Returns `{ skipped: true }` early |
| `GET /api/nft/verify` | **Still works** — existing access gates unaffected |
| `GET /api/nft/collections` | **Still works** — read-only |
| Provenance receipt pages | **Still work** — static public pages |
| Lua agent proposals | Suppressed via KV flag check (see doc 38) |

---

*Resolves: Phase 9 doc 37 — 3 blockchain experiments with full instrumentation,
metrics, success criteria, and kill-switch procedures*
