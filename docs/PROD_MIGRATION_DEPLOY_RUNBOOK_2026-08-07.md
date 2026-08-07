# Prod Migration Deploy Runbook — FK-1 backlog + corrective 124

**Project:** mixhive — Supabase prod `ljdolmqytncxhgojqguh` (BeeHiveStudio, EU-West)
**Date:** 2026-08-07
**Source:** MIXHIVE_SUPER_PROMPT §0 migration audit; FLOW_KEY_CODEX_HANDOFF B3

---

## 1. Context

Production ledger (measured 2026-08-07 via Management API, **correcting the
handoff's "no ledger / at 115" claim**) is **000–115 plus 118** — 111 entries.
`118`'s triggers (`trg_rsvp_notification`, `trg_event_change_notification`) are
confirmed live. Origin/main ships **116–124**. This runbook deploys the backlog
in dependency order, **skipping 116** (`premium_mixes` is gated behind the P14
monetization decision — never apply it) and **skipping 118** (already applied).

| Migration | Purpose | Applied |
|---|---|---|
| 116 `premium_mixes` | `mixes.required_tier` | **SKIP (P14 gate)** |
| 117 `mixes_visibility` | `mixes.visibility` column | **pending** |
| 118 `notification_triggers_events_rooms` | RSVP / event-change triggers | **✅ live (skip)** |
| 119 `flow_key_spine` | FK-1: spores, taps, RPCs, graph types | pending |
| 120 `publish_scheduled_pg_cron` | pg_cron publish job (**needs 117**) | pending |
| 121 `flow_key_germination` | FK-2 germination RPCs | pending |
| 122 `flow_key_countersign_and_notary` | countersigns, anchor | pending |
| 123 `flow_key_cap_override` | cap override | pending |
| 124 `restore_phase15_mythic_constraints` | **NEW corrective — restores 20 Phase 15 graph types 119 dropped** | **✅ applied** |
| **125 `restore_flow_key_rls_recursion_and_grants`** | **NEW corrective — fixes 42P17 RLS recursion + PUBLIC EXECUTE leak from 119** | **✅ applied** |

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

**117 → 119 → 120 → 121 → 122 → 123 → 124 → 125** (skip 116 [P14 gate], skip 118
[already live]). 125 is the post-deploy corrective for two merged-119 runtime
defects (RLS recursion, PUBLIC EXECUTE leak).

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

> **Never** run `supabase db push`/`db reset` against prod. Prod DOES have a
> migration ledger (measured 2026-08-07: 000–115 + 118), but it is **out of
> sync** with the file list, and `db push` would replay everything from the first
> gap. Use the Management API SQL path below, which runs one file at a time.

---

## 3. Pre-flight (prod) — verify before any write

### 3a. Credentials — Management API (no DB password needed)

A **direct Postgres URL is NOT stored anywhere** (every `.env` `DATABASE_URL` is
a placeholder). But the Supabase **Management API SQL endpoint works** with the
CLI's access token, which is stored in the **system keyring**:

```bash
SB=$(secret-tool search service supabase | grep '^secret =' | awk '{print $3}')
# -> sbp_<redacted>  (validate below; read-only value, do not commit)
curl -s -H "Authorization: Bearer $SB" \
  https://api.supabase.com/v1/projects/ljdolmqytncxhgojqguh/postgrest

# Run any SQL against prod (read-only for pre-flight, DDL for apply):
q() {
  curl -s -X POST -H "Authorization: Bearer $SB" -H "Content-Type: application/json" \
    -d "{\"query\":$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")}" \
    https://api.supabase.com/v1/projects/ljdolmqytncxhgojqguh/database/query
}
q "select 1 as ok"          # -> [{"ok":1}]
```

> The `DATABASE_URL` / `SB_ACCESS_TOKEN` secrets on the project (digests
> `3dab0863…`, `64a6a09c…`) are **write-only** — values are not retrievable.
> The `SB_ACCESS_TOKEN` in Vercel env is **empty**. The keyring token above is
> the operative credential.

### 3b. Confirm current state

```bash
# Ledger must be 000–115 + 118 (no 116/117, no 119+):
q "select version from supabase_migrations.schema_migrations order by version::int"

# 117 absent, 116 absent, 119 absent:
q "select column_name from information_schema.columns where table_schema='public' and table_name='mixes' and column_name in ('visibility','required_tier')"
q "select count(*) from pg_tables where schemaname='public' and tablename in ('flow_spores','flow_key_taps')"

# Capture the PRE-apply graph constraints (audit baseline).
q "select pg_get_constraintdef(oid) from pg_constraint where conname='mythic_edges_edge_type_check'"
q "select pg_get_constraintdef(oid) from pg_constraint where conname='mythic_nodes_node_type_check'"
# Save these — they must be a strict subset of the post-apply constraints.

# Data check: any row that would violate 119's narrow list already exists?
q "select distinct node_type from public.mythic_nodes"
q "select distinct edge_type from public.mythic_edges"
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
for n in 117 119 120 121 122 123 124; do
  f=$(ls $MIG/${n}_*.sql)
  echo "== applying $f =="
  q "$(cat "$f")" || { echo "FAILED at $f — transaction rolled back, stop here"; exit 1; }
done
```

> The Management API `/database/query` endpoint runs the whole file as one
> query; each file's own `begin; … commit;` gives atomicity. It returned
> `[{"ok":1}]` on a smoke test (2026-08-07).

### 4a. Checkpoint after 119 (graph constraints)

```bash
q "select pg_get_constraintdef(oid) from pg_constraint where conname='mythic_edges_edge_type_check'"
q "select pg_get_constraintdef(oid) from pg_constraint where conname='mythic_nodes_node_type_check'"
```

At this point 119's narrow lists are active (18 edge / 14 node types). Then 124
restores the full union. **Do not stop between 119 and 124** — a deploy that
pauses here leaves the graph types narrowed until 124 lands.

---

## 5. Post-apply verification

```bash
q "select column_name from information_schema.columns where table_schema='public' and table_name='mixes' and column_name='visibility'"

# 119 + 121–123 tables
q "select tablename from pg_tables where schemaname='public' and tablename like 'flow%' order by 1"

# 119 RPCs
q "select proname from pg_proc where pronamespace='public'::regnamespace and (proname like 'flow_key%' or proname in ('turn_flow_key','seal_flow_spore','revoke_flow_key','reap_stale_flow_drains'))"

# 120 cron job
q "select jobname, schedule, active from cron.job where jobname like '%publish%'"

# 124 — constraints restored (union)
q "select pg_get_constraintdef(oid) from pg_constraint where conname='mythic_edges_edge_type_check'"
q "select pg_get_constraintdef(oid) from pg_constraint where conname='mythic_nodes_node_type_check'"
# Compare against the pre-apply values captured in §3b — every pre-apply value must still be present.
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
2. **Push the branch** `fix/restore-phase15-graph-constraints` (carries migration
   124 + this runbook), open a PR, and merge so 124 is on `main`.
3. Merge `main` (currently 2 behind origin/main: `fed8eb1`, `28535ab`) into the
   deployment branch, then deploy to Vercel.
4. Revisit 116 only when the P14 monetization decision is approved.

---

## 8. Verification log (2026-08-07)

### Local stack

- 001→124 from-scratch: **clean** (119 files, 0 errors) — `/tmp/mig_reset2.log`
- Simulated prod order (all except 116): **clean** — `/tmp/mig_reset3.log`
- 117–124 idempotency re-run: **all PASS**
- 124 apply + re-apply: **PASS**; edge=35 types, node=17 types
- Confirmed 120 hard-requires 117; no backlog migration references 116's
  `required_tier`/`premium_mixes`

### Production (read-only probes, Management API)

- Migration ledger: **111 entries** = 000–115 **+ 118** (116/117 absent, 119+ absent)
- `118` triggers live: `trg_rsvp_notification`, `trg_event_change_notification` ✓
- `mixes.visibility` (117) and `mixes.required_tier` (116): **absent** ✓
- `mythic_edges` constraint: 077's full list (Phase 15 types present) ✓
- `mythic_nodes`: 63 `artist_profile` rows; `mythic_edges`: empty
- Management API SQL endpoint: **`[{"ok":1}]` smoke test passed**

### Applied to prod (2026-08-07)

117, 119, 120, 121, 122, 123, 124 applied via Management API SQL endpoint.
Post-apply probes exposed **two merged-119 defects**, fixed by **migration 125**
(PR #121, merged `aeb177f`), which is now also applied to prod:

- **RLS infinite recursion (42P17)**: `flow_spores` / `flow_spore_contributors` /
  `flow_spore_germinations` 500'd on any anon/authenticated read because the
  SELECT policies cross-referenced each other's tables. Fix: security-definer
  helpers `can_view_flow_spore`, `can_view_flow_spore_contributor`,
  `can_view_flow_spore_germination` (pattern from `can_view_collab_session`, 097)
  called from the policies — no cycle, same result.
- **Default PUBLIC EXECUTE leak**: `revoke ... from anon, authenticated` does not
  remove the default `PUBLIC` (`=X/postgres`) grant, so `has_function_privilege
  ('anon')` stayed true on every FK RPC — including service-role-only
  `seal_flow_spore` / `reap_stale_flow_drains` (no internal auth guard). Fix:
  `revoke all on function ... from public` then re-grant the intended role
  (service_role for writers, authenticated for client RPCs).

Prod post-125 probes: all flow_* tables + mixes → **200**; `reap_stale_flow_drains`
as anon → **401**; all arg-taking RPCs → 404; prod ACL table confirms
anon/auth EXECUTE removed on writers, authenticated-only on client RPCs, and
no PUBLIC grant anywhere.
