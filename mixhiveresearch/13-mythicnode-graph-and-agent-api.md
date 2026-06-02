# MIXHIVE MythicNode — Graph Storage, Lua API Surface & Implementation Contracts (Phase 6)

**Prepared for:** Codex (primary) + Claude Code (secondary)  
**Date:** 28 May 2026  
**Status:** Implementation-ready specification  
**Constraint:** Modular monolith, Postgres + Redis + background workers, no new foundational services.

---

## 1. Graph Storage — Postgres-First Design (No Neo4j in Phase 6)

### 1.1 Core Tables (Migration 045_mythicnode_graph.sql — created)

```sql
-- mythic_nodes: canonical lightweight nodes with traceability
create table if not exists public.mythic_nodes (
  id uuid primary key default gen_random_uuid(),
  node_type text not null check (node_type in (
    'artist_profile', 'mix', 'buzz', 'event', 'venue',
    'opportunity', 'promoter', 'label', 'curator', 'quest', 'agent'
  )),
  owner_id uuid references public.profiles(id) on delete set null,
  source_table text,                    -- e.g. 'mixes', 'opportunities', 'manual'
  source_id text,                       -- uuid or natural key as text
  title text,                           -- denormalized for fast display
  payload jsonb not null default '{}',  -- flexible attributes (genres, city, etc.)
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  embedding vector(1536)                -- optional; for similarity (pgvector)
);

create index idx_mythic_nodes_type on public.mythic_nodes(node_type);
create index idx_mythic_nodes_owner on public.mythic_nodes(owner_id) where owner_id is not null;
create index idx_mythic_nodes_source on public.mythic_nodes(source_table, source_id);
create index idx_mythic_nodes_embedding on public.mythic_nodes using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- mythic_edges: the actual graph
create table if not exists public.mythic_edges (
  id uuid primary key default gen_random_uuid(),
  from_node_id uuid not null references public.mythic_nodes(id) on delete cascade,
  to_node_id uuid not null references public.mythic_nodes(id) on delete cascade,
  edge_type text not null check (edge_type in (
    'performed_at', 'booked_by', 'submitted_to', 'collab_with',
    'remixed', 'engaged_with', 'recommended_by_agent',
    'followed', 'inspired_by', 'quest_milestone', 'yielded_outcome'
  )),
  weight numeric(6,3) not null default 1.0,
  occurred_at timestamptz,
  metadata jsonb not null default '{}',   -- role, agent_id, evidence, etc.
  source_event text,                      -- 'mix_publish', 'user_action:log_gig', 'lua_agent:xxx'
  created_at timestamptz not null default now()
);

create index idx_mythic_edges_from on public.mythic_edges(from_node_id);
create index idx_mythic_edges_to on public.mythic_edges(to_node_id);
create index idx_mythic_edges_type on public.mythic_edges(edge_type);
create index idx_mythic_edges_from_type on public.mythic_edges(from_node_id, edge_type);
create index idx_mythic_edges_composite on public.mythic_edges(from_node_id, to_node_id, edge_type);

-- Optional junction for multi-node quest evidence
create table if not exists public.quest_milestone_evidence (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  milestone_id uuid not null,
  node_id uuid not null references public.mythic_nodes(id),
  created_at timestamptz not null default now()
);
```

### 1.2 Quests & Milestones (Lightweight but First-Class)

```sql
create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  target_scene_tags text[] not null default '{}',
  timeframe_days int,
  status text not null default 'active' check (status in ('active','paused','completed','abandoned')),
  momentum numeric(5,2) default 0,
  created_by_agent_id uuid references public.lua_agents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_milestones (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','skipped')),
  target_node_type text,
  completed_at timestamptz,
  completed_via_edge_id uuid references public.mythic_edges(id)
);
```

**RLS:** Owners can CRUD their own quests/milestones. Public read on certain aggregated signals later.

### 1.3 Derivation & Backfill Strategy (Codex Ownership)

**Phase 6A — Backfill (one-time job):**
- Script that walks existing `profiles` → `artist_profile` nodes.
- Published `mixes` → `mix` nodes + `created` / `engaged_with` edges (use play/like counts for initial weight).
- `follows` → `followed` edges.
- `opportunity_saves` → `submitted_to` edges.

**Phase 6B — Live Derivation (triggers + workers):**
- On `mixes` insert (published=true) → create node + edges.
- On `opportunity_saves` insert/update → create/update `submitted_to` edge.
- On future "log performance" action → `performed_at` + `booked_by`.
- Background job (pattern from `audio_jobs` table + `040_audio_jobs.sql`) for:
  - Embedding generation (profile + mix text).
  - Periodic similarity edge creation (`collab_with` via shared engagement or genre+location overlap).
  - Quest progress recalculation.

**Recommendation:** Use a new `mythic_graph_jobs` table following the exact `audio_jobs` contract (enqueue, processing, complete, failed, retries).

### 1.4 Query Patterns Codex Must Support (for Lua + API)

1. **Ego graph (1–2 hops) for a user** — critical for weekly agent passes.
2. **Triangle / path-of-length-2–3 detection** (for Collab Web).
3. **Similarity** via embeddings + shared edges (pgvector + graph).
4. **Time-windowed activity** for momentum/quest scoring.
5. **Yield attribution** queries (edges that have `yielded_outcome` children).

Provide a small set of Postgres functions / RPCs:
- `get_mythic_ego_graph(user_id, depth, window_days)`
- `find_collab_triangles(user_id, min_weight, max_km)`
- `get_quest_relevant_nodes(quest_id, limit)`

---

## 2. Extended Lua Agent API Surface (Mythic Extensions)

Current `mh.*` surface (from `api/lua-agent/run.py` + migrations 013–033) is excellent for social automation. We extend it **read-only + proposal-only** for strategic Mythic work.

### 2.1 New Read-Only Functions (Safe, Sandboxed)

```lua
-- Graph queries (return arrays of node/edge tables or lightweight summaries)
mh.get_mythic_nodes(node_types?, owner_id?, limit?)          -- filter by type/owner
mh.get_mythic_edges(from_node_id?, edge_types?, limit?)       -- 1-hop
mh.query_mythic_graph(params_table)                           -- see below

-- Opportunity & goal helpers (already partially exist via api)
mh.get_relevant_opportunities(artist_id, filters_table?)      -- deadline, radius, genres, roles
mh.get_artist_goals(artist_id?)

-- Similarity & scene intelligence (new core power)
mh.get_similar_artists(artist_id, opts?)                      -- returns [{artist_node, score, shared_edges}]
mh.get_similar_artists_in_scene(artist_id, scene_tags, radius_km, limit)
mh.get_venues_with_history(genres?, city?, min_similar_bookings?)

-- Quest surface
mh.get_active_quests(owner_id?)                               -- usually just the caller's
mh.propose_quest_milestones(quest_id_or_params)               -- returns structured proposal
mh.record_quest_event(quest_id, event_type, payload)          -- append to quest log

-- Yield & attribution (read-only in Phase 6)
mh.get_yield_summary(artist_id, window_days?)                 -- top patterns that actually worked
```

**`query_mythic_graph` contract (example):**

```lua
local results = mh.query_mythic_graph({
  center = mh.owner_id,                    -- or a specific node id
  node_types = {"artist_profile", "venue", "opportunity"},
  edge_types = {"performed_at", "engaged_with", "submitted_to"},
  max_hops = 2,
  window_days = 180,
  min_weight = 0.5,
  within_km = 150,
  scene_tags = {"techno", "leftfield"}
})
```

The runtime translates this into a safe, parameterized Postgres query (or a small set of allowed queries). **Never allow arbitrary SQL from Lua.**

### 2.2 Proposal-Only Write Helpers (Never Auto-Execute)

```lua
-- These create "recommended_by_agent" edges + suggestion records visible in UI
mh.propose_action(action_type, target_node_id, rationale_text, draft_text?)
mh.propose_collab_mission(target_artist_node_id, context_node_ids, draft_message)
mh.propose_quest_update(quest_id, updates_table)   -- change status, add milestone, add log entry
```

All proposals go through the existing AI suggestion / notification pipeline so the user sees them in a consistent place.

### 2.3 Safety & Sandbox Rules (Codex Must Enforce)

- All new graph functions are **read-only** except the explicit `propose_*` family.
- `propose_*` calls are rate-limited per agent (e.g., max 5 proposals per run).
- Every proposal creates an auditable `mythic_edges` row with `source_event = 'lua_agent:' .. agent_id`.
- No network calls, no external APIs, no file I/O beyond the existing KV.
- KV namespace remains isolated per agent.
- New hard limits for strategic agents (slightly higher wall time than social automation agents, still capped).

---

## 3. Background Jobs & Worker Contracts

Follow the proven `audio_jobs` pattern from migration 040/041.

**New job types (example):**

- `mythic_backfill` — one-time or periodic full graph materialization.
- `mythic_derive_edges` — create similarity / triangle / yield edges from recent activity.
- `mythic_quest_progress` — recompute milestone status and momentum for active quests.
- `mythic_embedding` — generate or refresh embeddings for nodes.

**Job payload contract (same shape as AudioJobPayload):**

```ts
interface MythicGraphJobPayload {
  jobType: 'derive_edges' | 'quest_progress' | 'backfill_user' | 'embedding';
  scope: { userId?: string; questId?: string; nodeIds?: string[] };
  maxRetries?: number;
}
```

Enqueue from:
- API routes after meaningful user actions (mix publish, opportunity apply, "log gig").
- Lua agent runs (via internal Supabase call after successful execution).
- Cron / pg_cron for periodic maintenance.

---

## 4. API Surface for Frontend (Claude Code)

New or extended endpoints (under existing `/api/*` pattern):

- `GET /api/mythic/graph?userId=...&depth=2` — ego graph for rendering visualizations or agent context.
- `GET /api/quests` + `POST /api/quests` — CRUD for user quests.
- `POST /api/quests/:id/milestones/:id/accept` (or via existing suggestion acceptance flow).
- `POST /api/mythic/propose` (internal, called by Lua runtime).
- `GET /api/mythic/yield-summary` — "what actually worked" dashboard data.
- `POST /api/events/log-performance` — user or agent creates `performed_at` / `booked_by` edges (future "Gig Log" feature).

All responses must include provenance where relevant (`source_edges`, `agent_id`, `rationale`).

---

## 5. Success Metrics & Instrumentation (Phase 6)

Instrument everything as first-class events that can become `mythic_edges` or `quest_events`.

**Core Metrics (track in new `mythic_events` table or existing analytics patterns):**

1. **Graph Population**
   - Nodes created per week (by type)
   - Edges created per week (by type, by derivation method: backfill / trigger / agent / user_action)
   - % of active artists with ≥ N `performed_at` or `submitted_to` edges (real career signal)

2. **Agent Activation**
   - % of users who have ≥1 strategic Mythic Agent (Scene Orbit, Collab Weaver, Narrator, etc.)
   - Weekly active Mythic Agent runs (distinct from social automation agents)
   - Proposal acceptance rate (user clicked Accept/Edit vs Dismiss)

3. **Quest Health**
   - Quests created / completed / abandoned per week
   - Average time to first milestone completion
   - % of quest milestones that have real `yielded_outcome` or `performed_at` evidence

4. **Attribution Flywheel**
   - Number of `yielded_outcome` edges created (manual + inferred)
   - Correlation between "high agent suggestion acceptance" and later "yielded_outcome" events (lagging indicator)

5. **Narrative Usage**
   - Quest narrative / Legend Card exports
   - "Copy career summary" actions from Mythic Narrator

**Codex note:** Add a small `mythic_analytics_events` table (append-only, user_id, event_type, metadata, created_at) if the existing feed_events / moderation_signals pattern is not sufficient.

---

## 6. Implementation Phases (Recommended Split)

**Phase 6.1 (Foundation — Codex heavy)**
- Migration 045: `mythic_nodes`, `mythic_edges`, `quests`, `quest_milestones`
- Backfill script + basic derivation triggers
- Core Lua extension functions (read-only graph queries)
- `mythic_graph_jobs` worker pattern

**Phase 6.2 (First Feature — Shared)**
- Scene Orbit Quest MVP (one template + one strategic agent)
- Dashboard widget + quest log
- Basic "log a performance" action that creates real edges

**Phase 6.3 (Second Feature)**
- Collab Weaver triangles + Collab Mission cards
- Yield summary panel

**Phase 6.4 (Polish + Narrative)**
- Mythic Narrator (wasmoon strategic agent)
- Legend Card export
- Full provenance UI ("Why did the agent recommend this?")

---

## 7. Risks & Mitigations

| Risk                              | Mitigation |
|-----------------------------------|----------|
| Graph stays too sparse for new users | Strong onboarding + "seed your recent gigs" flow + default quests |
| Lua graph queries become slow     | Aggressive indexing + materialized views + caching in Redis for ego graphs |
| Agents propose low-quality actions early | Conservative proposal volume + strong "Why?" provenance + user feedback loop into agent scoring |
| Users treat quests as another todo list and abandon | Make quests beautiful, narrative, and tied to real graph events. Celebrate small wins with Legend Entries. |

---

## 8. Open Questions for Codex / Product

1. Should `venue` and `promoter` nodes start as fully manual seed data, or do we allow user-generated "I played at a new venue" that creates stub nodes (with moderation later)?
2. Do we expose any aggregated "scene health" signals publicly (e.g., "This Brussels techno micro-scene has 47 active artists with recent activity")?
3. How aggressive should the backfill be on historical data vs. only forward-looking for the first 3 months?

---

**This document (13) + the product specs in 12 + the strategy in 11 are the complete Phase 6 handoff package.**

Codex: Start with the schema migration and the Lua extension surface. Everything else is built on top.

Claude Code: The quest and suggestion UI patterns can begin in parallel once the basic node/edge tables exist and a few read RPCs are available.
---

## Phase 6 implementation status (31 May 2026)

### Delivered

- **Migration 064** (`supabase/migrations/064_lua_graph_tools.sql`) — 4 security-definer functions:
  - `lua_get_similar_artists(p_owner_id, p_limit)` — wraps `find_similar_artists_by_graph_overlap`, returns `{artist_id, display_name, username, avatar_url, shared_score}`
  - `lua_get_relevant_opportunities(p_owner_id, p_limit)` — genre/city/deadline scoring, excludes already-saved; returns `{opp_id, title, opp_type, city, deadline, genres, match_score}`
  - `lua_get_quest_momentum(p_owner_id)` — active + paused quests with milestone counts and days_remaining
  - `lua_propose_quest(p_owner_id, p_agent_id, p_title, p_scene_tags, p_timeframe_days)` — rate-limit 3/30d

- **`api/lua-agent/run.py`** — 4 new `mh.*` tools, all fail-open (return empty list / nil on error), limit capped at 20.

- **`mythic_strategist`** agent (`src/server/lua-agents/agents/mythic_strategist.lua`) — reads graph, calls `llm.json` for 3+3+2 structured brief, writes `recommended_by_agent` edges back into graph.

- **Cron schedule** (`src/app/api/cron/strategic-agents/route.ts`) — `mythic_strategist` added to `WEEKLY_AGENTS`, gated to `getDay() === 1` (Monday 07:00 UTC).

### TypeScript types

```typescript
// src/lib/types.ts
export interface SimilarArtistResult { artist_id, display_name, username, avatar_url, shared_score }
export interface RelevantOpportunityResult { opp_id, title, opp_type, city, deadline, genres, match_score }
export interface QuestMomentumEntry { quest_id, title, status, momentum, milestones_total, milestones_done, days_remaining }
```

### Not yet implemented (Phase 7 candidates)

- Opportunity Attribution Loop — `yielded_outcome` edge from mix → opportunity_save is in schema but not written by any route
- UI rendering of `mythic_strategist` suggestions in `/agents` inbox
- Graph-seeding onboarding flow
