# 53 — No-Code Lua Agent Builder & Compartment Specification

**Prepared:** 03 June 2026  
**Phase:** 15 — Quest Marketplace  
**Status:** Formal Spec / Blueprint

---

## 1. Purpose

The MIXHIVE No-Code Lua Agent Builder enables non-technical creators (DJs, producers, visual artists, managers) to create, configure, and share Lua agents without writing code. The builder:

- Provides a visual, flow-based editor for defining agent behavior.
- Compiles flows into sandboxed Lua modules that run inside the MIXHIVE runtime.
- Supports installation, configuration, and marketplace packaging of agents.
- Respects MIXHIVE's security, performance, and UX constraints.

This spec defines UX, data models, runtime architecture, and technical requirements for Codex and Claude Code.

---

## 2. High-Level Requirements

- Creators design agents using drag-and-drop blocks + prompts, not raw Lua.
- Each agent:
  - Responds to events (e.g. new mix, new quest, new gear listing).
  - Calls whitelisted tools (MythicNode graph, vectors, quests, notifications, marketplace).
  - Maintains its own state (per user or per session).
- The builder stores flows as a JSON intermediate representation (IR) and generates the corresponding Lua.
- Generated agents run in a sandboxed Lua compartment with:
  - No direct network or filesystem access.
  - Time and resource limits.
  - Full audit logging.
- The builder integrates with the Lua Agent Marketplace (doc 51):
  - Agents can be saved as templates/packages.
  - Users can clone, configure, and republish agents.

---

## 3. UX Overview

### 3.1 Entry Points

- From profile "Agents" tab: **"Create Agent"** button.
- From quest or project views: **"Add Automation / Agent"** button.
- From Lua Agent Marketplace: **"Clone & Customize"** an existing agent template.

### 3.2 Main Builder Layout

**Left sidebar**
- Agent list (your agents)
- Templates (featured / community)
- Block palette:
  - Triggers
  - Conditions
  - Actions
  - State

**Center canvas**
- Flow graph: Nodes = blocks, Edges = data/control flow
- Zoom/pan controls
- Undo/Redo

**Right panel**
- Selected block properties:
  - Parameters (e.g. filters, thresholds)
  - Prompt text (for LLM-powered decisions)
  - Output mappings (which fields to pass on)

**Toolbar**
- Save Draft | Publish | Test Run | Settings (name, description, category, tags)

### 3.3 Core User Actions

- Add / remove blocks
- Connect blocks by dragging connectors
- Configure blocks via forms and prompts
- Save draft / publish agent
- Run test runs:
  - Choose a sample event
  - See what the agent would do (mocked tool calls)
  - Inspect output at each block step

---

## 4. Block Types and Semantics

All flows are built from a fixed set of block types. Each block has:
- `type`, `id`, `inputs` / `outputs`, `params` (custom properties)

### 4.1 Triggers

Triggers define when an agent runs.

| Subtype | Description | Key params |
|---------|-------------|------------|
| `on_new_mix_published` | Mix uploaded by any profile | scene_filter, genre_filter |
| `on_new_quest_created` | Quest enters recruiting phase | discipline_filter, region_filter |
| `on_new_equipment_listing` | Gear listing posted | category_filter, max_price |
| `on_new_collab_request` | Another user invites to party | — |
| `on_schedule` | Cron-style periodic trigger | cron_expression (weekly/daily/hourly) |
| `on_manual_button` | User clicks "Run Agent" in inbox | button_label |
| `on_quest_role_opened` | A role opens up on a quest | role_type_filter |

### 4.2 Conditions

Conditions filter or route flow.

| Subtype | Description | Key params |
|---------|-------------|------------|
| `if_profile_matches` | Check profile attributes | scene, genre, reputation_min |
| `if_role_available` | Check if a role is still open | role_type |
| `if_vector_similarity_above` | Similarity threshold check | entity_type, threshold (0–1) |
| `if_price_below` | Gear price check | max_price |
| `if_tier_at_least` | Check user's progression tier | min_tier (1–5) |

### 4.3 Actions

Actions perform operations via whitelisted tools.

**Graph / MythicNode:**
| Subtype | Description |
|---------|-------------|
| `graph.find_nodes` | Query nodes by type and filter |
| `graph.find_edges` | Query edges by type |
| `graph.find_potential_collabs` | Shortcut: profiles likely to collab |

**Vectors:**
| Subtype | Description |
|---------|-------------|
| `vectors.find_similar_mixes` | k-NN on mix embeddings |
| `vectors.find_similar_artists` | k-NN on profile embeddings |
| `vectors.find_profiles_for_role` | Match profiles to an open role |

**Quests & Parties:**
| Subtype | Description |
|---------|-------------|
| `quests.create` | Draft a new quest |
| `quests.suggest_role_candidates` | Surface candidates for open role |
| `quests.update_status` | Advance quest phase |
| `party.add_member` | Add a profile to a party |

**Marketplace:**
| Subtype | Description |
|---------|-------------|
| `marketplace.suggest_gear` | Recommend gear listings |
| `marketplace.suggest_agents` | Recommend agent packages |

**Notifications:**
| Subtype | Description |
|---------|-------------|
| `notify.user` | Send inbox notification to a profile |
| `notify.create_suggestion` | Create an AI suggestion card |

### 4.4 State Blocks

| Subtype | Description |
|---------|-------------|
| `state.load` | Load current agent state (JSON) |
| `state.save` | Commit updated state |
| `state.get_field` | Read a specific field from state |
| `state.set_field` | Write a specific field to state |

Fields: `scope` (`user` or `session`), data schema (optional JSON Schema).

---

## 5. Intermediate Representation (IR)

### 5.1 IR Structure

```json
{
  "id": "agent_def_uuid",
  "name": "Scene Collab Scout",
  "version": 3,
  "blocks": [
    {
      "id": "block_1",
      "type": "trigger",
      "subtype": "on_new_mix_published",
      "params": { "genre_filter": "techno" },
      "position": { "x": 120, "y": 80 }
    },
    {
      "id": "block_2",
      "type": "action",
      "subtype": "graph.find_potential_collabs",
      "params": { "limit": 5 },
      "position": { "x": 380, "y": 80 }
    },
    {
      "id": "block_3",
      "type": "action",
      "subtype": "notify.create_suggestion",
      "params": { "suggestion_type": "collab_candidates" },
      "position": { "x": 640, "y": 80 }
    }
  ],
  "edges": [
    { "from": "block_1", "to": "block_2" },
    { "from": "block_2", "to": "block_3", "output_field": "candidates" }
  ],
  "meta": {
    "created_by": "profile_uuid",
    "created_at": "2026-06-03T00:00:00Z",
    "last_modified_at": "2026-06-03T00:00:00Z",
    "builder_version": "1.0"
  }
}
```

### 5.2 IR Requirements

- **Round-trip safe:** UI → IR → UI without data loss.
- **Versioned:** per agent and per builder version.
- **Separated concerns:** block positions are presentation; blocks/edges/params are logic.
- **Serializable:** stored as JSONB in `lua_agent_definitions.ir_json`.

---

## 6. Lua Code Generation

### 6.1 Generator Responsibilities

A backend "Lua generator" service:
1. Validates IR (no missing blocks, no orphan nodes, all required params present).
2. Converts IR to a Lua module implementing event handlers and tool calls.
3. Outputs Lua source + metadata (version tag, build timestamp).
4. Stores generated Lua source location in `lua_agent_versions.lua_source_location`.

### 6.2 Generated Lua Structure

```lua
-- Generated by MIXHIVE Builder v1.0 | agent_def_uuid | v3
-- DO NOT EDIT MANUALLY

local Agent = {}

function Agent.on_event(event)
  if event.type == "new_mix_published" then
    return Agent._flow_trigger_block_1(event)
  end
  return { status = "unhandled" }
end

function Agent._flow_trigger_block_1(event)
  -- block_1: trigger/on_new_mix_published
  if event.genre ~= "techno" then
    return { status = "filtered" }
  end

  -- block_2: graph.find_potential_collabs
  local candidates = api.graph.find_potential_collabs({
    mix_id = event.mix_id,
    limit = 5
  })
  if not candidates or #candidates == 0 then
    return { status = "no_results" }
  end

  -- block_3: notify.create_suggestion
  api.notify.create_suggestion(event.profile_id, {
    type = "collab_candidates",
    payload = candidates
  })

  return { status = "ok", candidates_found = #candidates }
end

return Agent
```

**Generation rules:**
- Each trigger → entrypoint function
- Blocks → sequential or branching code
- Conditions → `if/else` or `switch` logic
- State operations → `api.state.load` / `api.state.save` calls
- Output field mappings → local variable assignments passed to next block

---

## 7. Lua Compartment & Sandbox

### 7.1 Sandbox Environment

Each agent runs in a restricted Lua environment:

**Blocked globals:** `os`, `io`, `file`, `dofile`, `loadfile`, `require`, `package`, `debug`, `rawget`, `rawset`, `setfenv`, `getfenv`, `load`, `loadstring`

**Provided globals:**
```lua
api = {
  graph    = { ... },   -- MythicNode query functions
  vectors  = { ... },   -- Vector similarity search
  quests   = { ... },   -- Quest lifecycle operations
  party    = { ... },   -- Party management
  marketplace = { ... },-- Gear + agent marketplace queries
  state    = { ... },   -- Agent state (scoped to this agent)
  notify   = { ... },   -- Notification/suggestion dispatch
  log      = { ... },   -- Structured logging
}
event = { ... }         -- Current event payload (read-only)
```

### 7.2 Full API Surface

```lua
-- Graph / MythicNode
api.graph.find_nodes(filter)            -- { type, limit, filters }
api.graph.find_edges(filter)            -- { type, from_id, limit }
api.graph.find_potential_collabs(opts)  -- shortcut
api.graph.get_profile(profile_id)       -- profile node

-- Vectors
api.vectors.find_similar_mixes(mix_id, k)
api.vectors.find_similar_artists(profile_id, k)
api.vectors.find_profiles_for_role(role_id, k)

-- Quests
api.quests.create(opts)                 -- { title, narrative, roles[] }
api.quests.update(quest_id, opts)       -- partial update
api.quests.suggest_role_candidates(role_id, limit)
api.quests.get(quest_id)

-- Party
api.party.add_member(party_id, profile_id, role_id)
api.party.get(party_id)

-- Marketplace
api.marketplace.find_listings(filter)   -- gear listings
api.marketplace.find_agents(filter)     -- agent packages
api.marketplace.suggest_listings_for_profile(profile_id, opts)

-- State
api.state.load()                        -- returns current state table
api.state.save(new_state)               -- commits state (scoped to agent + user)
api.state.get(key)                      -- shorthand field read
api.state.set(key, value)               -- shorthand field write

-- Notifications
api.notify.user(profile_id, payload)    -- inbox notification
api.notify.create_suggestion(profile_id, payload)  -- AI suggestion card

-- Logging
api.log.info(message, data)
api.log.warn(message, data)
api.log.error(message, data)
```

### 7.3 Execution Model

```
Host receives event
  │
  ▼
Look up subscribed agents (by event type)
  │
  For each agent:
  │
  ├── Load lua_agents row (instance config)
  ├── Load lua_agent_definitions IR + generated Lua source
  ├── Instantiate sandbox with api table + event payload
  ├── Call Agent.on_event(event) with:
  │     - Time limit: 5 seconds per run
  │     - Memory limit: 32 MB
  │     - Max api calls: 20 per run
  │
  ├── Agent returns result table
  │
  ├── Host executes any api.notify / api.quests.create / etc.
  │   calls as real side effects (agents propose; host commits)
  │
  └── Persist logs to lua_agent_runs
```

**Key principle:** Lua agents are *advisory* — they return proposed actions; the host validates and commits them. Agents cannot directly mutate data; all mutations go through typed host functions.

### 7.4 Safety & Auditing

| Control | Implementation |
|---------|----------------|
| CPU time limit | 5s hard timeout per run; exceeded → `status = "timeout"` logged |
| Memory limit | 32 MB Lua heap per run |
| API call cap | 20 host API calls per run; exceeded → `status = "api_limit"` |
| Rate limiting | Per-agent: max 100 runs/hour; per-user: max 500 agent runs/hour |
| Audit log | Every run logged in `lua_agent_runs` (event_type, status, elapsed_ms, api_calls, outputs) |
| Kill switch | Admins can set `lua_agents.status = 'disabled'` globally or per-user |
| Input validation | All `api.*` call arguments type-checked by host before execution |
| No on-chain issuance | Agents may propose NFT mints; the host/UI requires explicit user confirmation |

---

## 8. Data Model & Storage

### 8.1 Tables

```sql
-- Agent definition (draft or published)
lua_agent_definitions (
  id                   UUID PRIMARY KEY,
  name                 text NOT NULL,
  description          text,
  creator_profile_id   UUID REFERENCES profiles(id),
  category             text,
  tags                 text[],
  ir_json              JSONB NOT NULL,
  version              int DEFAULT 1,
  status               text DEFAULT 'draft',  -- draft | published | retired
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
)

-- Version history (immutable snapshots)
lua_agent_versions (
  id                    UUID PRIMARY KEY,
  agent_definition_id   UUID REFERENCES lua_agent_definitions(id),
  version               int NOT NULL,
  ir_json               JSONB NOT NULL,
  lua_source_location   text,  -- Supabase Storage path
  created_at            timestamptz DEFAULT now()
)

-- Installed agent instances per user
lua_agents (
  id                UUID PRIMARY KEY,
  definition_id     UUID REFERENCES lua_agent_definitions(id),
  owner_profile_id  UUID REFERENCES profiles(id),
  config            JSONB DEFAULT '{}',
  status            text DEFAULT 'active',  -- active | paused | disabled
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
)

-- Per-agent runtime state
lua_agent_state (
  id          UUID PRIMARY KEY,
  agent_id    UUID REFERENCES lua_agents(id),
  scope       text NOT NULL,  -- 'user' | 'session'
  scope_key   text NOT NULL,  -- profile_id or session_id
  state_json  JSONB DEFAULT '{}',
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(agent_id, scope, scope_key)
)

-- Run audit log
lua_agent_runs (
  id             UUID PRIMARY KEY,
  agent_id       UUID REFERENCES lua_agents(id),
  event_type     text,
  status         text,  -- ok | timeout | api_limit | error | filtered
  elapsed_ms     int,
  api_calls_made int,
  output_json    JSONB,
  error_message  text,
  created_at     timestamptz DEFAULT now()
)
```

### 8.2 Key Indexes

```sql
CREATE INDEX ON lua_agent_definitions(creator_profile_id, status);
CREATE INDEX ON lua_agents(owner_profile_id, status);
CREATE INDEX ON lua_agent_state(agent_id, scope, scope_key);
CREATE INDEX ON lua_agent_runs(agent_id, created_at DESC);
```

---

## 9. APIs

### 9.1 Builder APIs (Next.js App Router routes)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/lua/agents` | List user's agent definitions |
| POST | `/api/lua/agents` | Create new definition (IR) |
| GET | `/api/lua/agents/[id]` | Get definition + current version |
| PUT | `/api/lua/agents/[id]` | Update IR / metadata |
| POST | `/api/lua/agents/[id]/build` | Trigger Lua code generation |
| POST | `/api/lua/agents/[id]/test` | Dry run with sample event payload |
| GET | `/api/lua/agents/[id]/versions` | List version history |

### 9.2 Runtime APIs (internal, server-to-server)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/internal/lua-events` | Dispatch event to subscribed agents |
| GET | `/internal/lua-logs` | Fetch run logs for monitoring |
| POST | `/internal/lua-agents/[id]/disable` | Admin kill switch |

---

## 10. Validation and Testing

### 10.1 Builder Validation

**IR validation (on save / before build):**
- All required fields present on each block type
- No unknown block subtypes
- All edges reference existing block ids
- At least one Trigger block present
- All trigger outputs eventually reach an Action block (no dead-end conditions)

**Lua validation (after build):**
- Syntax check via Lua parser
- Sanity run with a mock event (no real API calls; all `api.*` stubs return empty arrays)

### 10.2 Runtime Tests

**Unit tests:** Each block type's generated Lua snippet is independently testable.

**Integration tests:** Event → agent → host calls → expected output assertions (using in-process mock api table).

**Load tests:** 1,000 concurrent agent runs to verify time limits and resource caps hold.

---

## 11. Marketplace Integration

- **Publishing:** Set `lua_agent_definitions.status = 'published'`; creates corresponding `lua_agent_packages` row (doc 51) via the publish flow.
- **Installing from marketplace:** Creates a `lua_agents` row (instance) for the buyer with `definition_id` pointing to the package's definition snapshot.
- **Configure:** Opens builder UI with parameters pre-filled from `config_schema` defaults + user's saved config.
- **Clone & Edit:**
  1. Creates a new `lua_agent_definitions` row with `creator = new_user`, `ir_json = cloned IR`.
  2. New version history starts at v1.
  3. Opens in builder canvas.

---

## 12. Non-Goals (Phase 1)

- No raw Lua code editing panel in the builder UI.
- No arbitrary external HTTP requests from Lua (only whitelisted api.* functions).
- No direct on-chain transaction issuance from Lua; agents propose; host/UI confirms.
- No multi-agent orchestration from within a single Lua run (agents can call `api.notify` but cannot directly invoke other agents).
- No streaming/long-running agents; each run must complete within the 5-second budget.

---

## 13. Phase Acceptance Criteria

Phase 1 of the builder is complete when:

1. The visual builder UI can create, edit, and save valid IR graphs.
2. Test flows run end-to-end with mocked events in the builder sandbox.
3. The backend stores IR and generated Lua, runs agents in sandbox for real events, logs all runs.
4. At least one production agent ("Scene Collab Scout" or "Quest Assistant") is implemented via the builder and deployed to a small beta cohort.
5. Safety limits (timeout, memory, API cap, kill switch) are verified under load.
