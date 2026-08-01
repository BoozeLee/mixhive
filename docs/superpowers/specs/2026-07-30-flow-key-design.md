# Flow Key — Design Spec

**Date:** 2026-07-30
**Status:** design approved in part (mechanism + governance settled); awaiting spec review
**Roadmap subject:** P7.5 — Flow Key (Part I, extends P7 Mythic Live Creative Rituals)
**Migration:** 119 (highest existing: 118)

---

## 1. The problem

Everything MixHive harvests today requires **ending the thing first**.

A Mythic Live Creative Ritual accumulates real material — stems in
`collab_session_assets`, a timeline in `collab_session_events`, chat peaks,
votes, Session Spirit actions. To get any of it out you must end the session,
wait for the post-process job, review proposed edges, approve them, then create
a one-shot handoff token that expires in ten minutes and germinates nowhere.

That is opening the hive. Everyone has to leave for the beekeeper to eat.

## 2. The mechanic

A Flow Hive Flow Frame is harvested with a key inserted from **outside** the
hive and turned 90°. The plastic comb cells split vertically, capped honey
drains by gravity into a trough and out a tube, and the key is turned back to
re-close the cells. The bees are never disturbed. Critically: **only capped
honey drains.** Uncapped cells hold nectar that is still curing; it does not
flow, and forcing it spoils the harvest.

| Flow Hive | MixHive |
|---|---|
| Flow Frame inside the hive | a running `collab_session` |
| capped honey | settled assets + pinned marks, before the turn boundary |
| uncapped nectar | the take being played *right now* — never drains |
| insert key, turn 90° | host turns the Flow Key |
| cells split, gravity drain | snapshot assembles the spore |
| trough and tube | signed spore document in private storage |
| the jar | a durable `flow_spores` row owned by the turner |
| turn the key back | drain closes, genome hashed and sealed |
| bees undisturbed | session never pauses; ambient glyph only, no modal |
| one frame drains at a time | a single drain lock per session |

## 3. Settled decisions

1. **The honey is live work, mid-ritual.** Not attention, not the relational
   graph. Stems, marks, timeline.
2. **The host turns it, and the room sees it turn.** A hex glyph rotates 90°;
   an event lands in `collab_session_events`. Non-blocking, no modal, no
   confirm, no sound. Contributor provenance rides the spore automatically, so
   quiet extraction is structurally impossible rather than merely discouraged.
3. **The drained artifact is a spore, not a manifest.** It is durable,
   self-verifying, and germinatable N times; every germination writes lineage
   back to its parent. Carbon fraction (humans) and silica fraction (machines)
   are declared separately.
4. **Snapshot on turn, capped cells only.** No streaming tap. The half-finished
   take stays the room's business — this is what keeps the tap from being a
   wiretap.
5. **No tokens.** No minting, no supply, no transfers, no price, no market.
   Crypto is used for *attestation, content addressing, and capabilities*.

## 4. Naming

- Product surface: **Flow Key**. The artifact: **spore**. Re-opening it:
  **germination**. The hash: the **genome**. The on-chain batch: the **notary
  anchor**.
- Code: `flow_key_*` / `flow_spore_*` / `FlowKey*` / `Spore*`.
- **Never a bare `key`.** `key` already means *musical* key in this codebase
  (`src/components/KeyChip.tsx`, the audio worker's chroma detection). The
  double meaning is good culture and terrible identifiers.
- The word "NFT" appears nowhere in the UI, and nothing in this design mints
  one. Existing `nft_collections` / `nft_tokens` are untouched.

## 5. What "capped" means

A cell is eligible to drain iff **all** hold:

1. It is a `collab_session_assets` row whose upload completed and whose
   `created_at <= tap.opened_at` (the snapshot boundary), **and**
2. it is not `collab_session_state.current_asset_id` while
   `playback_status = 'playing'` — the live take is uncapped, **or** the host
   has explicitly capped it via a `flow_key_cap` event (the override that lets
   you drain the thing you just finished), **and**
3. it is not soft-deleted.

Marks are `collab_session_events` rows of type `mark`, `vote`, or pinned
`chat-message` occurring before the boundary.

The predicate is pure and table-testable. It also gives an honest UI state:
**"3 of 5 cells capped."** No jargon, no lie.

## 6. Data model — migration 119

Idempotent, additive, no edits to existing migrations. All writes go through
security-definer RPCs, following the pattern established by `045` and `096`
(`mythic_edges` has SELECT-only RLS).

### 6.1 `flow_key_taps` — the mechanical lock

```
session_id   uuid primary key references collab_sessions(id) on delete cascade
is_open      boolean not null default false
opened_by    uuid references profiles(id)
opened_at    timestamptz
drain_lock   uuid references flow_spores(id)   -- the spore currently draining
turns_count  int not null default 0
```

One row per session. One frame drains at a time — a second turn while
`is_open` returns 409.

### 6.2 `flow_spores` — the jar

```
id             uuid primary key default gen_random_uuid()
session_id     uuid not null references collab_sessions(id) on delete cascade
turned_by      uuid not null references profiles(id)
state          text not null default 'draining'
                 check (state in ('draining','sealed','void'))
opened_at      timestamptz not null default now()
sealed_at      timestamptz
generation     int not null default 0          -- 0 = drained from a live ritual
parent_hash    text                            -- genome hash of the ancestor spore
root_session_id uuid references collab_sessions(id)
carbon         jsonb not null default '{}'     -- human fraction
silica         jsonb not null default '{}'     -- machine fraction
capped_count   int not null default 0
skipped_count  int not null default 0
genome_version int not null default 1
content_hash   text                            -- sha256 of the canonical genome
seal_signature text                            -- Ed25519 detached signature
seal_key_id    text                            -- which server key signed it
storage_path   text                            -- spore doc in private bucket
created_at     timestamptz not null default now()
unique (content_hash)
```

`carbon` holds contributors, capped asset digests, marks, chat peaks. `silica`
holds agent credits (mirroring `mix_agent_credits`), detected key/BPM, and
Session Spirit actions with their action-budget spend. The split is declared,
not inferred — the AI Band badge already establishes that MixHive states its
machine fraction openly.

**Audio is never in the genome.** Only per-asset content digests (sha256 of the
storage object). The genome stays small and stable; the audio stays private
behind signed URLs.

### 6.3 `flow_spore_contributors` — relational provenance

```
spore_id        uuid not null references flow_spores(id) on delete cascade
profile_id      uuid references profiles(id)
agent_id        uuid references ai_agents(id)
fraction        text not null check (fraction in ('carbon','silica'))
role            text not null          -- host | contributor | audience_mark | agent
weight          numeric not null default 0
wallet_address  text
countersignature text                  -- optional: contributor's own signature
countersigned_at timestamptz
primary key (spore_id, coalesce(profile_id, agent_id))
```

Provenance is relational rather than only jsonb so it is queryable, RLS-able,
and deletable under P9 privacy work.

### 6.4 `flow_spore_germinations` — replication

```
id               uuid primary key default gen_random_uuid()
spore_id         uuid not null references flow_spores(id) on delete cascade
germinated_by    uuid not null references profiles(id)
target           text not null check (target in ('beehive','mixhive_session','mix_draft'))
child_session_id uuid references collab_sessions(id)
child_mix_id     uuid references mixes(id)
child_spore_id   uuid references flow_spores(id)
edge_id          uuid references mythic_edges(id)
created_at       timestamptz not null default now()
```

### 6.5 `flow_spore_grants` — capabilities, not assets

```
id             uuid primary key default gen_random_uuid()
spore_id       uuid not null references flow_spores(id) on delete cascade
issued_by      uuid not null references profiles(id)
grantee_profile uuid references profiles(id)
grantee_address text
rights         text[] not null            -- {'read'} | {'read','germinate'}
parent_grant_id uuid references flow_spore_grants(id)   -- attenuated delegation
token_hash     text not null unique       -- sha256, never the token itself
expires_at     timestamptz not null
used_at        timestamptz                -- only for single-use download grants
revoked_at     timestamptz
created_at     timestamptz not null default now()
```

### 6.6 `flow_spore_anchors` — the notary

```
id            uuid primary key default gen_random_uuid()
batch_date    date not null unique
merkle_root   text not null
leaf_count    int not null
chain         text                    -- 'base-sepolia' | 'base' | null (off-chain only)
tx_hash       text
attestation_uid text
anchored_at   timestamptz
created_at    timestamptz not null default now()
```

Plus `flow_spores.anchor_id uuid references flow_spore_anchors(id)` and
`flow_spores.merkle_proof jsonb` (the inclusion path).

### 6.7 Graph extensions

Extend `mythic_nodes_node_type_check` with `'flow_spore'`, and
`mythic_edges_edge_type_check` with `'drained_from'` and `'germinated_into'`.

**Lineage reuses the existing `inspired_by` edge type.** This matters more than
it looks: a mix born from a germinated spore then appears in
`trace_outcome_causation` (migration 096) with zero new UI. The Yield Forensics
panel already walks that chain. The mycelium remembers the dance without
anyone filing paperwork.

### 6.8 Storage

Private bucket `flow-spores` (spore documents, JSON). Reads only via signed URL
issued against a valid grant. Audio continues to live in `mix-audio`.

## 7. RPCs — migration 119

1. **`turn_flow_key(p_session_id uuid) returns jsonb`**
   Asserts `can_manage_collab_session`. Asserts no open drain. Computes the
   capped set. If empty → returns `{nothing_capped: true}` without opening.
   Otherwise: upserts the tap open, inserts a `flow_key_turned` row in
   `collab_session_events`, creates the `flow_spores` row in `draining`, sets
   `drain_lock`, increments `turns_count`. Atomic, single statement block.

2. **`seal_flow_spore(p_spore_id, p_carbon, p_silica, p_content_hash, p_signature, p_key_id, p_storage_path, p_capped, p_skipped)`**
   Service-role only. `state → 'sealed'`, writes the genome fields, closes the
   tap, clears `drain_lock`, inserts `flow_key_sealed`, populates
   `flow_spore_contributors`.

3. **`germinate_flow_spore(p_spore_id, p_target, p_child_id) returns uuid`**
   Requires a valid unrevoked grant carrying `germinate`, or ownership. Writes
   the germination row plus a pre-approved `inspired_by` edge (child → parent),
   mirroring the shape of `record_milestone_outcome`. Returns the edge id.

4. **`revoke_flow_key(p_session_id)`** — host kills an open drain; spore → `void`.

5. **`countersign_flow_spore(p_spore_id, p_signature, p_address)`** — verifies
   the caller is a listed contributor, stores their countersignature.

6. **`reap_stale_flow_drains()`** — cron. Voids `draining` spores older than 15
   minutes and closes their taps. A session must never be left with a stuck-open
   key.

## 8. API surface

Under `src/app/api/mythic/sessions/[id]/flow-key/`:

- `POST turn` → `{ spore_id, capped, skipped }` | 409 `drain_already_open` |
  422 `nothing_capped` | 403
- `POST seal` → assembles, canonicalizes, hashes, signs, stores, seals
- `GET state` → tap state for the room (realtime channel + polling fallback)
- `POST revoke` → host kill

Under `src/app/api/flow-spores/[id]/`:

- `GET` → spore metadata (owner and contributors only)
- `GET genome` → the canonical genome JSON + signature (public if the spore is
  public; this is what makes offline verification possible)
- `POST germinate` → `{ target }`
- `POST grant` → issue a capability; returns the token **once**
- `POST countersign`
- `GET download?token=…` → reuses the **exact** proven single-use pattern from
  `src/app/api/mythic/sessions/[id]/handoff/route.ts`: `createHash('sha256')`
  over the token, conditional `update` guarding `used_at is null` and
  `expires_at > now()`, 410 on reuse.

The upgrade over today's handoff: **the download pipe is still one-shot; the
jar is not.** The spore persists and can be granted again.

Public, unauthenticated: `GET /.well-known/mixhive-flow-key.json` — current and
previous Ed25519 seal public keys with their `key_id`s, for offline verification.

## 9. Crypto — "NFT 2.0" without tokens

The premise: what people actually wanted from NFTs was *provenance you can
verify and ownership nobody can rewrite*. What they got was *a transferable
asset with a price*. Those are separable, and the second one is what makes the
scene laugh. So: attestations, content addressing, and capabilities. **A
signature cannot be speculated on, because it cannot be transferred.**

Four layers, each independently useful. Layer A works with no chain, no wallet,
and no network.

### Layer A — the genome (always on, free, no chain)

Canonicalize the spore body with **JCS (RFC 8785)** — sorted keys, normalized
numbers, UTF-8 — then `sha256`. That digest is `content_hash`: the genome.

The genome body includes `parent_hash`. So spores form a **hash-chained DAG of
descent**, exactly like git commits. A spore does not point at its history; it
*contains* it. Alter any ancestor and every descendant hash breaks. This is the
self-replication property doing real cryptographic work rather than decoration.

Sign the digest with **Ed25519** (`node:crypto`, zero new dependencies) using
`FLOW_KEY_SEAL_KEY`, server-only, with `seal_key_id` for rotation. The detached
signature ships inside the spore document. Anyone holding a spore can verify
integrity and origin offline against the published `.well-known` key.

**This layer alone satisfies most of what "on-chain provenance" is asked to do.**
It is never framed in the UI as the lesser option, and nothing nags toward the
chain.

### Layer B — contributor countersignatures (opt-in, free, no gas)

Each carbon contributor may countersign the genome with **their own key** via
`personal_sign`, verified server-side with `ethers.verifyMessage` — the identical
primitive already used in `src/app/api/wallet/connect/route.ts`.

This is the actual ownership claim, and it is the right shape: *"I was in that
room and I say so, signed with a key only I hold."* It is non-transferable by
construction. Contributors without a wallet are recorded by `profile_id` and can
countersign later; the existing `verifyTokenOwnership` profile-or-address OR
filter shows this pattern already works. **You get your proof whether or not you
ever touch crypto.**

### Layer C — the notary anchor (opt-in, batched, testnet first)

Per-spore on-chain writes are the wrong unit: they cost gas proportional to
culture, which is backwards.

Instead, a daily cron builds a **Merkle tree over every genome sealed that day**,
stores the root in `flow_spore_anchors`, and writes each spore's inclusion proof
to `flow_spores.merkle_proof`. Optionally the root — and only the root — is
anchored on chain. **One transaction per day regardless of volume.** Each spore
then carries a proof that it existed before a specific block, verifiable by
anyone against the public root.

Anchoring uses **EAS (Ethereum Attestation Service) on Base**, attesting a
schema of `(batch_date, merkle_root, leaf_count)`. Attestations are not tokens:
no supply, no transfer, no owner, revocable by the attester. Off-chain EAS
attestations cost nothing and are the default; on-chain is a flag.

Hard constraints, from existing project policy:

- **Base Sepolia only.** `FLOW_KEY_CHAIN` defaults to `base-sepolia`; `base`
  requires an explicit P14 flag. Assert this in tests.
- **No paid RPC.** Public endpoints only, so every chain write happens in the
  cron path and never in a request path. Rate limits degrade the anchor, never
  the seal.
- **No paid pinning.** No IPFS dependency. Genome JSON is served hash-addressed
  from MixHive at `/api/flow-spores/[id]/genome`. *Named trade-off:* that URI
  is centralized and rots if MixHive dies — mitigated because the genome is
  small, public, self-verifying, and downloadable, so holders can self-archive,
  and a user-supplied CID may be attached if they pin it themselves.
- **Anchor failure never blocks a seal.** Layer A has already succeeded. The UI
  reads "unanchored", never "failed".
- `nft-service.syncCollection()` is currently a placeholder no-op and stays
  that way. This design does not depend on it.

### Layer D — capabilities, not assets

Germination rights are granted by a **signed, attenuable capability** rather than
owned by a token: `{spore_id, grantee, rights, expires, nonce, parent_grant}`,
stored hashed in `flow_spore_grants`. A holder may delegate onward but only
**with equal or fewer rights** (attenuation), forming a grant chain that is
revocable at any ancestor.

So access is cryptographic and delegable — and structurally unsellable, because
a grant names its grantee and dies when revoked. This is the honest version of
"the right to grow from this": permission, not property.

### Privacy — on-chain immutability vs. P9 deletion

An immutable public ledger and a GDPR erasure obligation genuinely conflict.
The resolution is structural: **the chain never receives personal data.** The
Merkle root commits only to hashes. Genome bodies, names, wallets, and audio
digests live in Postgres and storage, and are deletable. Deleting them leaves
the on-chain root committing to a preimage that no longer exists — an orphan
pointer, which is exactly the desired end state. EAS attestations are
additionally revocable. Contributor countersignatures are deletable rows.

## 10. UI / UX

- **`FlowKeyGlyph`** in `MythicSessionRoom` — a `HexCell` that rotates 90° on
  turn. Corner-anchored, non-blocking, `aria-live="polite"` announcing
  "Flow Key turned — comb draining." Under `prefers-reduced-motion`, cross-fade
  to a split-cell state instead of rotating.
- Host gets a real `<button>`; the audience gets a status glyph.
- Capped vs. uncapped render as filled vs. hollow hex cells with the literal
  count. No jargon.
- Tokens only, from `src/styles/tokens.ts` — the black/gold cyber-hive brand
  already carries honey-amber, so no new hues.
- 320px stable: glyph collapses to a 24px cell, the count moves into the
  accessible label.
- **`SporeCard`** — a spores surface (profile tab). Two-tone hex showing the
  carbon/silica split, generation number, germination count, truncated copyable
  genome hash, and an anchor state chip (`sealed` / `anchored`).
- **Germinate** — a sheet with three targets: Beehive (`beehive://spore/<token>`),
  a new MixHive ritual, or a mix draft.
- **No modal and no `confirm()` anywhere in the turn path.** This flow already
  eliminated `confirm()` dialogs during Experiment 1; keep it that way.
- **No price, anywhere in the ritual room, ever.** The room is not a shop.
- Nothing about anchoring appears inside a live session. Anchoring is reached
  from the spore's own surface, after seal, so commerce and cryptography can
  never interrupt the ritual.

## 11. Error handling

| Condition | Behaviour |
|---|---|
| Turn while a drain is open | 409 `drain_already_open` |
| Turn with nothing capped | 422 `nothing_capped`; ambient copy "nothing's capped yet" — expected early, not a toast storm |
| Non-host turn | 403 |
| Seal fails mid-drain | spore stays `draining`; `reap_stale_flow_drains` voids it after 15 min and closes the tap |
| Download token reused | 410 (existing handoff semantics) |
| Germinating a `void` spore | 410 |
| Grant revoked or expired | 403 with the reason distinguished |
| Anchor cron fails or is rate-limited | spore stays `sealed`, `anchor_id` null, retried next run; never surfaced as a failure |
| Countersignature address not a listed contributor | 403 |

## 12. Testing

**Unit**
- The capping predicate — table-driven across playing/paused, before/after
  boundary, manual cap, soft-deleted.
- JCS canonicalization + hash stability: identical input → identical hash; key
  reordering → identical hash; any asset digest change → different hash.
- Hash-chain integrity: mutating an ancestor genome invalidates descendants.
- Merkle tree construction and inclusion-proof verification, including
  single-leaf and odd-leaf-count batches.
- Ed25519 sign/verify round-trip and key rotation via `seal_key_id`.
- Capability attenuation: a child grant can never exceed its parent's rights;
  revoking an ancestor kills the chain.

**RPC / database**
- Atomicity of turn/seal/revoke.
- Drain-lock concurrency: two simultaneous turns yield exactly one 409.
- RLS: a non-contributor cannot select a spore, its contributors, or its grants.

**Integration**
- turn → seal → download once → download again → 410.
- germinate → `inspired_by` edge exists → `trace_outcome_causation` returns the
  chain (proving the Yield Forensics tie-in works with no new UI).
- Offline verification: fetch genome + `.well-known` key, verify with no DB access.

**Live, per the project verification standard**
`npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` · deploy ·
then three throwaway production users: host turns the key mid-session, the room
sees the glyph, **the session never pauses**, the spore germinates into a new
ritual with lineage intact, then hard-delete everything.

**Chain**
Assert `FLOW_KEY_CHAIN !== 'base'` unless the P14 flag is set. Anchor tests run
against Base Sepolia only.

## 13. Scope — decomposed

This is too large for one implementation plan. Three sub-projects, each with its
own plan:

- **FK-1 — the spine.** Capping predicate, `flow_key_taps` / `flow_spores` /
  `flow_spore_contributors`, turn/seal/revoke/reap RPCs, spore document, Layer A
  genome + Ed25519 seal, `FlowKeyGlyph`, single-use download grant. No chain, no
  germination. **Spec this into a plan first.**
- **FK-2 — germination.** Grants and attenuation, germinate endpoint and the
  three targets, lineage edges, `SporeCard` surface, Layer B countersignatures,
  Yield Forensics verification.
- **FK-3 — the notary.** Merkle batching, inclusion proofs, off-chain EAS
  attestations, then on-chain Base Sepolia anchoring. Mainnet gated to P14.

## 14. Authenticity check

1. *Human agency and mystery?* Increased. The key is visible, the live take is
   never drained, contributors hold their own signing keys, and any contributor
   can revoke a grant chain.
2. *Would a veteran nod or roll their eyes?* Rolls hard at "mint your set."
   Nods at "the record of who was in the room, that nobody can sell or rewrite."
   Hence: no tokens, no supply, no price, no transfers, and the word "NFT"
   nowhere in the UI.
3. *Native or tourist?* Native. It grafts onto rituals, stems, and the graph
   MixHive already runs, and it is built from primitives already in the
   repository (`ethers` verify, sha256 token hashing, security-definer RPCs).
4. *Does it protect the edge?* Yes, and the capped-cells rule is the load-bearing
   piece: the unfinished thing stays unharvestable. The tap refuses to be a
   surveillance device, and that refusal is mechanical rather than a policy
   promise.
