# Flow Key FK-1 — Codex handoff

Claude Code implemented FK-1 on `feat/flow-key-fk1`.
Spec: `docs/superpowers/specs/2026-07-30-flow-key-design.md`
Plan: `docs/superpowers/plans/2026-07-30-flow-key-fk1-spine.md`

FK-1 is code-complete and green on its own terms: **78 new tests across 10 suites,
all passing**, zero lint warnings in any `flow-key` file. It cannot be deployed
yet for reasons that have nothing to do with it. Those are listed first.

---

## BLOCKERS (pre-existing, not introduced by FK-1)

### B1 — `main` does not build 🔴

`npm run build` at `4983fc7` fails with **10 Turbopack errors**, all from one
missing export:

```
./src/components/agents/AgentCard.tsx:5:1
Export getAgentCategoryColor doesn't exist in target module
```

`src/styles/tokens.ts` has **zero** occurrences of `getAgentCategoryColor`, but
it is imported by `AgentCard.tsx`, `DesktopSidebar.tsx`, `MobileNav.tsx`,
`Messages.tsx`, and `MixDetail.tsx`. Last commit to touch `tokens.ts` is
`a362213` (genre-colour retune).

Verified pre-existing: none of those files appear in
`git diff --name-only 4983fc7..feat/flow-key-fk1`.

**Deliberately not fixed here.** `main` has ~9 files of uncommitted, in-flight
P1 design-system work (raw `<button>` → `ui/*` `IconButton`/`Button`), and
`getAgentCategoryColor` looks like part of that same sweep. Adding a guessed
implementation risks colliding with it. Whoever owns that sweep should land the
export.

**Until this is fixed, no branch can deploy to production.**

### B2 — Undeclared build dependency

`next.config.mjs` imports `@next/bundle-analyzer`, which is **not in
`package.json`**. A clean `npm ci` then `npm run build` fails with
`ERR_MODULE_NOT_FOUND`. It only works in the existing checkout because it was
installed ad hoc at some point.

`next.config.mjs` and `package.json` scripts are Codex-owned, so this is written
down rather than patched. Fix: add `@next/bundle-analyzer` to `devDependencies`.

### B3 — No migration ledger, and no staging database

`supabase/.temp/project-ref` is `ljdolmqytncxhgojqguh` — **that is production.**
There is no scratch or staging project. Commit `b064cc6` records that
"production has no migration ledger", so **which of migrations 105–118 are
actually applied to production is unknown.**

Migration 119 was therefore verified against a **local** Postgres
(`supabase start`) with the full 001→119 chain applied from scratch. It cannot
be confirmed safe against production until someone establishes what production's
real schema state is.

### B5 — Vercel deploys are failing on cron limits 🔴

The `Vercel` check fails on every PR at **0 seconds**, before any build, with the
same short link on every commit and every branch: `https://vercel.link/3Fpeeb1`,
which resolves to **`vercel.com/docs/cron-jobs/usage-and-pricing`**.

`vercel.json` declares **11 crons**, two of them sub-daily
(`*/10 * * * *` on `/api/cron/publish-scheduled`, and `0 9 1 * *` monthly). Plan
cron allowances are what this needs checking against.

This is why nothing has been reaching `mixhive.vercel.app` — it is not a code
failure and no amount of green GitHub Actions will fix it. Either raise the plan
or consolidate crons (several daily jobs could run from a single dispatcher).

**FK-1 adds no cron requirement** — see §1.

### B4 — `src/lib/database.types.ts` is badly stale

Committed file is **2,701 lines**; regenerating against the real schema produces
**7,357**. It is missing `ai_agents`, every `collab_*` table, and the whole
ritual layer. This drift predates FK-1 by many migrations.

Not regenerated here — it would be a ~4,600-line change touching everything and
is unrelated to this feature. FK-1 does not depend on it (routes call `.rpc()`
by name with explicit casts).

---

## What Codex needs to do for FK-1 itself

### 1. Cron: stale-drain reaper — **do NOT add one**

An earlier draft of this handoff asked for
`{ "path": "/api/cron/flow-key-reap", "schedule": "*/5 * * * *" }` in
`vercel.json`. **That was wrong** — see blocker B5: `vercel.json` already
declares 11 crons and the Vercel deployment is failing on cron limits. A twelfth
on a five-minute schedule would deepen the exact failure that is currently
blocking every deploy.

`turn_flow_key` now self-heals instead. Before it claims the drain lock it voids
this session's own drain if it has been open longer than 15 minutes and clears
the orphaned tap. A crashed seal can no longer strand the key in the open
position, and **correctness no longer depends on a cron running at all**.

`reap_stale_flow_drains()` and `/api/cron/flow-key-reap` still ship, as an
optional global sweep for observability. Wire it only if and when the cron
budget allows — nothing breaks if it never runs.

### 2. Environment variables (Vercel, server-only)

| Name | Value | Notes |
|---|---|---|
| `FLOW_KEY_SEAL_KEY` | Ed25519 PKCS#8 PEM private key | **Server-only. Never `NEXT_PUBLIC_`.** |
| `FLOW_KEY_SEAL_KEY_ID` | e.g. `fk-2026-07` | Identifies which key sealed a spore. |
| `FLOW_KEY_SEAL_KEY_PREVIOUS` | previous **public** key PEM | Optional; only after a rotation. |
| `FLOW_KEY_SEAL_KEY_PREVIOUS_ID` | e.g. `fk-2026-01` | Optional. |

Generate:

```bash
node -e "const{generateKeyPairSync}=require('node:crypto');const{privateKey}=generateKeyPairSync('ed25519');console.log(privateKey.export({type:'pkcs8',format:'pem'}).toString())"
```

Without `FLOW_KEY_SEAL_KEY` the seal route fails closed and
`/.well-known/mixhive-flow-key.json` serves an empty key list. Turning the key
then cannot produce a sealed spore — the correct failure mode, since an unsigned
spore is worthless.

### 3. Migration 119

`supabase/migrations/119_flow_key_spine.sql`.

Verified locally on a from-scratch 001→119 chain:

- 4 tables: `flow_spores`, `flow_key_taps`, `flow_spore_contributors`, `flow_spore_grants`
- `mythic_edges.edge_type` → **18** values (all 16 prior, plus `drained_from`, `germinated_into`)
- `mythic_nodes.node_type` → **14** values (all 13 prior, plus `flow_spore`)
- 4 RPCs: `turn_flow_key`, `seal_flow_spore`, `revoke_flow_key`, `reap_stale_flow_drains`
- private `flow-spores` storage bucket
- `ai_agents` seeded with `session-spirit`
- **Second apply exits 0** — idempotent, no duplicate agent row

**Before applying to production**, confirm the two constraint replacements
retain every pre-existing value:

```bash
psql "$PROD_URL" -c "\d+ public.mythic_edges" | grep edge_type_check
psql "$PROD_URL" -c "\d+ public.mythic_nodes" | grep node_type_check
```

These `drop constraint … / add constraint …` pairs are the riskiest statements
in the migration: `mythic_edges` and `mythic_nodes` back quests, Yield
Forensics, agent credits, and NFT provenance. See **B3** — production's schema
state is unverified.

Also note migration 119 adds two columns to `collab_session_assets`
(`upload_complete boolean not null default true`, `deleted_at timestamptz`).
`default true` is deliberate: 097 inserts an asset row only once its
`storage_path` is known, so every existing row is a completed upload.

---

## Two corrections FK-1 made to the spec

Both were found by running the migration, not by reading:

1. **`ai_agents` is keyed by `slug text`**, not a uuid `id`. The spec's
   `agent_id uuid references ai_agents(id)` does not exist.
   `flow_spore_contributors` carries `agent_slug` instead, matching
   `mix_agent_credits.agent_slug`.
2. **`mix_agent_credits` has no `session_id`** — it is keyed by `mix_id`, so it
   cannot describe a live room. The silica fraction is derived from
   `collab_session_events` where `actor_type = 'agent'`, which is where 097's
   bounded Session Spirit actually records its actions.

---

## Test status

- **78 FK-1 tests, 10 suites, all passing.**
- Full suite: **513 passed, 3 failed** — the 3 failures are in
  `palette-parity.test.ts` and `DiscoverLane.test.tsx`, and were confirmed to
  fail identically at base commit `4983fc7` by running them in a detached
  worktree. Not caused by FK-1.
- `npm run lint`: 97 warnings repo-wide, **0 in any flow-key file**.
- `npx tsc --noEmit`: not a meaningful gate in this repo (pre-existing; test
  globals and many modules do not resolve). Trusted jest + lint + build instead.
- `npm run build`: **fails on B1**, inherited from `main`.

## Not in FK-1 (by design)

Germination, capability grants with attenuation, contributor countersignatures,
`SporeCard`, the Merkle notary and any chain code — all FK-2/FK-3. Nothing in
FK-1 touches `nft_collections` or `nft_tokens`, and the word "NFT" appears
nowhere in the UI.
