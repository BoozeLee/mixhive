# Doc 35: Blockchain Integration Blueprint — 2026 Update

> **Phase 9 — Blockchain Integration & Experiments**
>
> This document updates the chain/platform decisions from doc 28 with a 2026
> landscape scan, confirms or revises the Base+Zora choice, and adds the
> risk/compliance/kill-switch layer that doc 28 deferred.
>
> **Does NOT duplicate:** doc 28 (philosophy, 3 use cases, nft_collections schema,
> UX constraints), doc 32 (creator governance, sync architecture, provenance),
> doc 34 (SIWE wallet connect flow, T0/T1/T2 tiers, security framing).

---

## 1. 2026 Music/Web3 Landscape Scan

### 1.1 Music NFT Platforms

| Platform | Minting model | Royalty splits | AI track support | MIXHIVE fit |
|---|---|---|---|---|
| **Zora** | Protocol-level; creator deploys own ERC-1155 contract via SDK; no platform cut | EIP-2981 royalties; SplitMain for multi-creator | No specific AI attribution; metadata-agnostic | ✅ Best fit: non-custodial, SDK-driven, Base-native, zero platform fees |
| **Catalog** | Curated 1/1 editions; manual artist onboarding | Secondary royalties enforced via contract | No | ❌ Curated gate blocks automated per-mix drops |
| **Sound.xyz** | Edition model (fixed supply); artist-first UX | Revenue split between artist and early supporters | No | ⚠️ Interesting edition model but requires human curation; no open API |
| **Soundverse** | AI-generated audio NFTs; model attribution in metadata | Platform-managed splits | ✅ Native: every generation gets provenance metadata | ⚠️ Promising for AI provenance use case; limited public API as of 2026; monitor for future integration |
| **Manifold** | Self-managed ERC-721/1155 contracts; creator full control | EIP-2981; creator sets splits manually | Metadata-extensible | ⚠️ Fallback if Zora API has downtime; more DevOps overhead |

**Decision confirmed:** Zora remains primary for Phase 9. Its SDK is the most
production-ready for programmatic per-mix drops, runs natively on Base, and
requires no platform relationship or curation approval. Soundverse is flagged
for Phase 10 evaluation if AI provenance attestation becomes a hard requirement.

### 1.2 L2 Options Comparison

| Chain | Avg gas per ERC-1155 mint (2026) | Coinbase onramp | ERC-1155 support | Dev tooling | MIXHIVE verdict |
|---|---|---|---|---|---|
| **Base** | ~$0.002 | ✅ Native | ✅ | Excellent (viem, wagmi, Zora SDK) | ✅ **Primary — confirmed** |
| Optimism (OP Mainnet) | ~$0.003 | ✅ | ✅ | Good | Viable fallback; slightly higher fees |
| Arbitrum One | ~$0.002 | Partial | ✅ | Good | Comparable to Base but no Coinbase onramp advantage |
| Polygon zkEVM | ~$0.001 | ❌ | ✅ | Maturing | Lowest fees but no onramp; higher friction for new users |

**Decision confirmed:** Base L2 (chain ID 8453) is the primary chain. The Coinbase
onramp removes the single biggest barrier for non-crypto DJs. Zora's native Base
deployment avoids cross-chain bridging friction. Polygon zkEVM is worth
re-evaluating for Phase 10 if transaction volume grows above 50k/month.

### 1.3 Embedded Wallet Providers

Embedded wallets create a wallet behind the scenes when a user authenticates
with social login (Google, email), eliminating MetaMask/Coinbase app requirements
for non-crypto users.

| Provider | Social login | EIP-4337 (gas sponsorship) | Open source / self-hostable | GDPR/data residency | Price | CLAUDE.md constraint |
|---|---|---|---|---|---|---|
| **Privy** | ✅ Google, email, SMS | ✅ Bundler integration | SDK open; cloud infra | EU region available | Free tier → paid at scale | ⚠️ Cloud dependency at scale |
| **Dynamic** | ✅ Google, email, wallet link | ✅ | SDK open; cloud infra | EU available | Free tier → paid | ⚠️ Same |
| **Turnkey** | ✅ via partner | ✅ | API-based; self-hostable KMS | SOC2; data residency options | Pay-per-wallet | ✅ Could be self-hosted |
| **ZeroDev** | ✅ (via Kernel) | ✅ Native (Kernel AA) | ✅ Open source | EU compatible | Free | ✅ Best fit |

**Decision for Phase 9:** **ZeroDev + Kernel** for embedded wallets.

Rationale:
- Fully open-source (MIT) — complies with CLAUDE.md "no paid APIs" constraint
- Native EIP-4337 account abstraction with gas sponsorship (MIXHIVE covers gas
  for soulbound token mints)
- Integrates with Base via Alchemy/Pimlico bundler (Alchemy has a free tier)
- Social login via `@zerodev/social-wallet` using OAuth OIDC; no centralized
  key custody — keys are distributed via threshold signatures
- Fallback: if ZeroDev is unavailable, the existing `window.ethereum` flow
  (MetaMask/Coinbase) continues to work without change

**Note on CLAUDE.md constraint:** ZeroDev SDK itself is free and open-source.
The gas bundler (Alchemy/Pimlico) is a paid API in production. This is
acceptable because: (a) it's infrastructure cost, not a feature gate; (b) the
bundler can be swapped for self-hosted Alto bundler at $0. Phase 9 docs specify
the self-hosted path; Cloud bundler is permitted for development/staging only.

---

## 2. Integration Stance — Confirmed Decisions

### 2.1 Primary L2
**Base (chain ID 8453)** — no change from doc 28.

### 2.2 Minting Modes

| Phase | Mode | When |
|---|---|---|
| Phase 9 (current) | **Platform-mediated via Zora SDK** | All experiments; <1,000 collections lifetime |
| Phase 10+ (future) | Direct contract deployment | >1,000 collections OR custom royalty splits needed OR Zora changes pricing |

Platform-mediated means MIXHIVE calls `@zoralabs/protocol-sdk` which deploys
standard Zora ERC-1155 factory contracts. MIXHIVE does not write or audit its
own Solidity. This limits customization but eliminates smart-contract risk for
Phase 9.

### 2.3 Embedded Wallet Rollout

Embedded wallets (ZeroDev) launch as **Tier 0.5** between the existing tiers:

- **Tier 0:** No wallet, full app access (unchanged)
- **Tier 0.5 (new):** Social-login embedded wallet — appears in Settings after user
  explicitly opens "Web3 & NFTs" section; wallet created silently in background;
  no address shown unless user clicks "Show my wallet address"
- **Tier 1:** External wallet connected via SIWE (unchanged)
- **Tier 2:** Active minting/claiming (unchanged)

Embedded wallet holders are treated as Tier 1 for read access and Tier 2 for
minting/claiming — but gas is always sponsored by MIXHIVE for embedded wallets.

---

## 3. On/Off-Chain Split — Definitive Table

| Data | Lives in | Rationale |
|---|---|---|
| Token ownership (who holds what) | **On-chain (Base)** + mirrored to `nft_tokens` | Blockchain is source of truth; DB is a read cache |
| Transfer events | **On-chain** + synced to `nft_tokens.holder_address` | Events polled via `/api/cron/nft-sync` |
| Soulbound enforcement | **On-chain (ERC-5192)** | Cannot be overridden by DB state |
| Royalty splits (EIP-2981) | **On-chain** | Enforced at marketplace level, not MIXHIVE |
| Collection metadata (supply, name, description) | **IPFS URI** (pinned by Zora) + `nft_collections` | IPFS = permanent; DB = queryable |
| Audio content | **Supabase Storage / CDN only** | Never on-chain; see doc 28 §6 |
| `nft_collections` rows | **Postgres** | Config, status, sync cursor |
| `nft_tokens` rows | **Postgres** | Read cache of on-chain state |
| `wallet_links` | **Postgres** | `(profile_id, wallet_address, wallet_type)` |
| Co-creator approvals | **Postgres** (`nft_collections.co_creator_approvals`) | Off-chain consent; not enforced on-chain in Phase 9 |
| Graph edges (owns_nft_of, backed_quest, etc.) | **MythicNode (mythic_edges)** | Enables graph traversal for agent context |
| Agent web3 proposals | **`ai_suggestions` table** | Standard suggestion pipeline |
| Experiment events | **`experiment_events` table** | Standard A/B instrumentation |

### 3.1 Sync Integrity Rules

1. **DB is a cache, not a source of truth.** Any ownership query that gates
   real access (e.g. "can this user join the private collab room?") must verify
   against `nft_tokens.holder_address` which is populated by the sync cron —
   never trust unverified `profile_id` claims.
2. **Optimistic writes are soft.** When a user initiates a mint, a
   `nft_tokens` row is inserted with `status='pending'`. It becomes
   authoritative only after the sync cron confirms the on-chain `Transfer` event.
3. **Chain reorgs.** Base produces finality in ~2 seconds. For Phase 9, treat
   any transfer confirmed at depth >6 blocks as final. If a reorg removes a
   previously-confirmed transfer, soft-delete the `nft_tokens` row and
   remove the `owns_nft_of` edge; do not delete `nft_collections`.

---

## 4. Risk & Compliance Controls

### 4.1 Regulatory Language Rules

MIXHIVE operates in a grey regulatory zone for digital assets in the EU
(Belgium, MiCA framework, 2024 onward). The following rules are binding on all
UI copy, API response messages, and documentation:

**Banned phrases — never use in UI, emails, or marketing:**

| Banned | Use instead |
|---|---|
| "Investment" / "invest in this artist" | "Support this release" |
| "Buy" / "purchase" | "Claim" / "Get" |
| "Earn" / "yield" / "returns" | — (do not imply financial return) |
| "Floor price" / "market value" | — (never show price or value) |
| "Liquidity" / "tradeable" | — (no secondary market framing) |
| "Token" (primary usage) | "Pass" / "proof" / "receipt" |
| "NFT" (primary usage in UI) | "Supporter pass" / "Gig proof" / "Quest receipt" |

**Permitted language:** "Support", "Back", "Claim your proof", "Receipt",
"Supporter pass", "Gig proof", "Quest backing", "Unlock access".

**Regulatory boundary:** Soulbound tokens (non-transferable) are furthest from
securities risk. Edition passes where MIXHIVE sponsors gas are the most
borderline — access-only framing and zero price display are mandatory.

### 4.2 Feature Flags

Two flag layers control all web3 features:

**Global server-side flag:**
- Environment variable: `WEB3_EXPERIMENTS_ENABLED` (`"true"` | `"false"`, default `"false"`)
- Checked at: API route entry point (`/api/nft/*`, `/api/wallet/*`, `/api/cron/nft-sync`)
- Effect when `"false"`: API returns `{ error: 'web3_disabled', status: 503 }`; UI CTAs hidden

**Per-user opt-in flag:**
- Column: `profiles.web3_tier` (`int`, 0–2, default 0)
- 0 = no web3 features; 1 = wallet connected/readable; 2 = minting/claiming enabled
- Set by user action (connecting wallet sets to 1; completing first mint sets to 2)
- Admin can reset to 0 if a user account is flagged for compliance review

**Lua agent flag check** (see doc 38):
```lua
local flag = mh.kv_get("web3_experiments_enabled") or "false"
if flag ~= "true" then return end
```

### 4.3 Kill-Switch Procedures

**Scenario A — Disable new minting only (leave existing tokens operational):**
1. Set `WEB3_EXPERIMENTS_ENABLED=false` in Vercel env
2. Re-deploy (auto-propagates to all API routes)
3. `/api/nft/collections` POST returns 503; GET continues to work
4. Existing `nft_tokens` remain queryable; `GET /api/nft/verify` continues to work
5. Cron sync (`/api/cron/nft-sync`) continues to run — keeps existing tokens up to date

**Scenario B — Full web3 shutdown (incident response):**
1. Set `WEB3_EXPERIMENTS_ENABLED=false`
2. Set `NFT_SIGNER_KEY` to an invalid value (prevents any accidental on-chain transactions)
3. Pause Vercel cron for `/api/cron/nft-sync`
4. Post status update to affected creators; no data is lost (DB state remains)
5. Restore by reversing steps in order

**Scenario C — Contract bug post-deploy (no upgrade path for immutable contracts):**
1. Set `status='paused'` on affected `nft_collections` row
2. Disable claim flow for that collection in UI (API rejects with `{ error: 'collection_paused' }`)
3. Migrate: create a replacement collection with `replacement_collection_id` stored in the original's `props.replaced_by`
4. Communicate to holders: "We've upgraded the pass contract. Your original token is still yours; claim the replacement at no cost."
5. Snapshot holders from old collection → airdrop replacement tokens (sponsored gas)
6. Document incident in `nft_collections.props.incident_log`

### 4.4 Data Residency & Privacy

- `wallet_address` is a public blockchain address — not PII in the legal sense
  but still treated with care: not shown to other users without explicit opt-in
- `siwe_nonces` expire after 1 hour and are hard-deleted after 24 hours via
  the existing pg_cron job
- ZeroDev embedded wallet: threshold key shares are distributed; MIXHIVE holds
  0 key shares; user can export their key at any time
- No private keys are ever stored in Postgres, Supabase Storage, or Vercel env
  except `NFT_SIGNER_KEY` (server-only signer for sponsored mints)
- GDPR right to erasure: deleting a profile clears `wallet_address`, `wallet_links`,
  `siwe_nonces`; on-chain token ownership cannot be erased (blockchain is immutable)
  — this is disclosed in Terms of Service

---

## 5. Codex & Claude Code Handoffs

**Codex handoff (Phase 9 implementation):**
- No new migrations required for this doc (flag and language rules are operational,
  not schema changes)
- Add `WEB3_EXPERIMENTS_ENABLED` env var guard to `/api/nft/collections/route.ts`,
  `/api/nft/collections/[id]/mint/route.ts`
- Add `profiles.web3_tier` column migration (new `int` column, default 0)

**Claude Code handoff:**
- Settings "Web3 & NFTs" section: show/hide based on `WEB3_EXPERIMENTS_ENABLED`
  flag (read via a lightweight `/api/flags` route or build-time env)
- NftMintModal: check `web3_tier >= 2` before allowing mint; prompt upgrade if not
- All UI copy must follow the banned/permitted language table in §4.1

---

*Resolves: Phase 9 doc 35 — 2026 L2 landscape scan, integration stance, on/off-chain split, risk/compliance controls*
