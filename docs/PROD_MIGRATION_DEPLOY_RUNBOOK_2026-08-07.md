# Prod Migration Deploy Runbook — FK-1 backlog + corrective 124

**Project:** mixhive — Supabase prod `ljdolmqytncxhgojqguh` (BeeHiveStudio, EU-West)
**Date:** 2026-08-07
**Source:** MIXHIVE_SUPER_PROMPT §0 migration audit; FLOW_KEY_CODEX_HANDOFF B3

---

## 1. Context

Production is at migration **115**. Origin/main ships **116–124**. This runbook
deploys the backlog in dependency order, **skipping 116** (`premium_mixes` is
gated behind the P14 monetization decision — never apply it).

| Migration | Purpose | Applied |
|---|---|---|
| 116 `premium_mixes` | `mixes.required_tier` | **SKIP (P14 gate)** |
| 117 `mixes_visibility` | `mixes.visibility` column | pending |
| 118 `notification_triggers_events_rooms` | RSVP / event-change triggers | pending |
| 119 `flow_key_spine` | FK-1: spores, taps, RPCs, graph types | pending |
| 120 `publish_scheduled_pg_cron` | pg_cron publish job (**needs 117**) | pending |
| 121 `flow_key_germination` | FK-2 germination RPCs | pending |
| 122 `flow_key_countersign_and_notary` | countersigns, anchor | pending |
| 123 `flow_key_cap_override` | cap override | pending |
| **124 `restore_phase15_mythic_constraints`** | **NEW corrective — restores 20 Phase 15 graph types 119 dropped** | pending |

### Why 124 is required

Migration 119 §6 replaced the `mythic_edges`/`mythic_nodes` CHECK constraints
using lists built from the pre-077 shape. That **silently dropped 20 types**
that migration 077 (Phase 15) legitimately added:

- `mythic_edges` drops (17): `listed_by`, `interested_in`, `sold_to`,
  `scene_gear`, `quest_created_by`, `quest_requires_role`, `party_for_quest`,
  `role_filled_by`, `party_member`, `assisted_by_agent`, `completed_quest`,
  `role_completed_as`, `agent_created_by`, `owns_agent`, `used_in_quest`,
  `assistant_for_role`, `agent_inspired_by`
- `mythic_nodes` drops (3): `equipment_listing`, `collab_quest`,
  `lua_agent_package`

The FK-1 spine plan's Step 3 gate ("if any pre-existing type is missing, the
migration is destructive — stop and fix") only greps for the *presence* of the
expected 16 types, so the missing 17 were never caught. `mythic.edge.create` /
`mythic.node.find_or_create` (`src/server/lua-agents/tools/mythic.ts`) accept
arbitrary type strings, so any future writer using a Phase 15 type would hit a
CHECK violation.

Migration 124 re-adds the union of 066 + 077 + 119 types. Verified additive and
idempotent on the local stack.

### Deploy order

**117 → 118 → 119 → 120 → 121 → 122 → 123 → 124** (skip 116).

Dependencies verified: 120 reads `mixes.visibility` (created by 117); no
migration in 117–124 references `required_tier` or `premium_mixes` (116).

---

## 2. Pre-flight (local, already done — re-run only if repo changes)

Verified in a worktree at origin/main + corrective 124:

```bash
cd /tmp/mixhive-mig
supabase start                       # local Postgres :54322
supabase db reset                    # 119 files applied, 0 errors
```

- Full 001→124 chain: **clean, 119 migrations, 0 errors**
- Re-apply 117–124 individually: **all idempotent (exit 0)**
- Simulated prod order (skip 116): **clean**
- 124 is additive: edge constraint final = **35 types**, node = **17 types**,
  including all 20 Phase 15 types restored

> **Never** run `supabase db push`/`db reset` against prod. The prod project has
> **no migration ledger** (handoff B3), so `db push` would replay everything.

---

## 3. Pre-flight (prod) — verify before any write

### 3a. Credentials

You need a **direct Postgres URL for prod** (pooler or direct, password required).
Not stored locally. From Supabase dashboard → Connect → pooler/direct:

```bash
# Session pooling (transaction-safe for psql DDL):
export PROD_URL="postgresql://postgres.ljdolmqytncxhgojqguh:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
# or direct (same region): db.ljdolmqytncxhgojqguh.supabase.co:5432
```

> The access token for `supabase` CLI is **not** stored on this machine
> (`~/.supabase` has no token; no env var). `projects list` worked earlier via a
> transient login — re-login if needed: `supabase login`.

### 3b. Confirm current state

```bash
# Must show only up to 115: required_tier/visibility/flow_spores all absent.
psql "$PROD_URL" -c "\d+ public.mixes" | grep -E "required_tier|visibility"   # expect no rows
psql "$PROD_URL" -c "select count(*) from pg_tables where schemaname='public' and tablename in ('flow_spores','flow_key_taps');"  # expect 0

# Capture the PRE-apply graph constraints (audit baseline).
psql "$PROD_URL" -c "\d+ public.mythic_edges" | grep edge_type_check > /tmp/edge_pre.txt
psql "$PROD_URL" -c "\d+ public.mythic_nodes" | grep node_type_check > /tmp/node_pre.txt
# Save these — they must be a strict subset of the post-apply constraints.

# Data check: any row that would violate 119's narrow list already exists?
psql "$PROD_URL" -Atc "select distinct node_type from public.mythic_nodes;"
psql "$PROD_URL" -Atc "select distinct edge_type from public.mythic_edges;"
```

Known current values (measured 2026-08-07): `mythic_nodes` has 63
`artist_profile` rows; `mythic_edges` is empty. So 119's `ADD CONSTRAINT` will
not fail on existing rows regardless.

---

## 4. Apply — one migration at a time, verify each

Each migration file wraps itself in `begin; … commit;`, so a failure rolls back
atomically. Apply in order, pausing after 119 to confirm the graph constraints:

```bash
MIG=/tmp/mixhive-mig/supabase/migrations
for n in 117 118 119 120 121 122 123 124; do
  f=$(ls $MIG/${n}_*.sql)
  echo "== applying $f =="
  psql "$PROD_URL" -v ON_ERROR_STOP=1 -f "$f" || { echo "FAILED at $f — rollback complete, stop here"; exit 1; }
done
```

### 4a. Checkpoint after 119 (graph constraints)

```bash
psql "$PROD_URL" -c "\d+ public.mythic_edges" | grep edge_type_check
psql "$PROD_URL" -c "\d+ public.mythic_nodes" | grep node_type_check
```

At this point 119's narrow lists are active (18 edge / 14 node types). Then 124
restores the full union. **Do not stop between 119 and 124** — a deploy that
pauses here leaves the graph types narrowed until 124 lands.

---

## 5. Post-apply verification

```bash
# 117
psql "$PROD_URL" -Atc "select count(*) from information_schema.columns where table_schema='public' and table_name='mixes' and column_name in ('visibility');"

# 119 + 121–123 tables
psql "$PROD_URL" -Atc "select tablename from pg_tables where schemaname='public' and tablename like 'flow%' order by 1;"

# 119 RPCs
psql "$PROD_URL" -Atc "select proname from pg_proc where pronamespace='public'::regnamespace and proname like 'flow_key%' or proname in ('turn_flow_key','seal_flow_spore','revoke_flow_key','reap_stale_flow_drains');"

# 120 cron job
psql "$PROD_URL" -Atc "select jobname, schedule, active from cron.job where jobname like '%publish%';"

# 124 — constraints restored (union)
psql "$PROD_URL" -c "\d+ public.mythic_edges" | grep edge_type_check
psql "$PROD_URL" -c "\d+ public.mythic_nodes" | grep node_type_check
# Diff against /tmp/edge_pre.txt / /tmp/node_pre.txt — every pre-apply value must still be present.
```

### REST smoke probes (public anon key, from `.env.production`)

```bash
URL="https://ljdolmqytncxhgojqguh.supabase.co"
KEY="<VITE_SUPABASE_ANON_KEY>"
# 117: visibility readable
curl -s -o /dev/null -w "mixes.visibility -> %{http_code}\n" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/mixes?select=visibility&limit=1"
# 119: flow_spores exists -> expect 401 (RLS) or 200, NOT 404
curl -s -o /dev/null -w "flow_spores -> %{http_code}\n" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/flow_spores?select=id&limit=1"
# 116 (must remain skipped): required_tier -> expect 400/42703, NOT 200
curl -s -o /dev/null -w "mixes.required_tier -> %{http_code}\n" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/mixes?select=required_tier&limit=1"
```

---

## 6. Rollback

Migrations are DDL inside `begin;…commit;`. Because each runs as one
transaction, a **failed apply already rolls back fully** — the fix is to correct
the SQL and re-apply, never to hand-reverse.

If a migration *succeeds* but must be reverted, the general pattern is
inverse-DDL (new migration, never hand-edits):

- **117**: `alter table public.mixes drop column if exists visibility;`
- **119**: drop FK-1 tables (`flow_spore_grants`, `flow_spore_contributors`,
  `flow_key_taps`, `flow_spores`), restore `collab_session_assets` columns, revoke
  RPCs. Prefer a new `125_revert_*.sql` rather than in-place SQL.
- **124**: re-drop the union constraints back to 119's narrow lists (only if 119
  must also be reverted — otherwise keep).

**Do not** attempt `supabase db reset` or `db push` on prod for rollback.

---

## 7. Post-deploy application steps

1. **Set `FLOW_KEY_SEAL_KEY` on Vercel** (both production and preview). Without
   it the seal route fails closed — correct failure mode, but the Flow Key
   cannot produce sealed spores until set. Generate with
   `npx ed25519-keygen` or `openssl genpkey -algorithm ed25519` (base64 seed).
2. **Commit migration 124** (not yet on any branch — it's in the worktree only).
3. Merge `main` (currently 2 behind origin/main: `fed8eb1`, `28535ab`) into the
   deployment branch, then deploy to Vercel.
4. Revisit 116 only when the P14 monetization decision is approved.

---

## 8. Verification log (2026-08-07, local stack)

- 001→124 from-scratch: **clean** (119 files, 0 errors) — `/tmp/mig_reset2.log`
- Simulated prod order (all except 116): **clean** — `/tmp/mig_reset3.log`
- 117–124 idempotency re-run: **all PASS**
- 124 apply + re-apply: **PASS**; edge=35 types, node=17 types
- Confirmed 120 hard-requires 117; no backlog migration references 116's
  `required_tier`/`premium_mixes`
