# Doc 31 — Lua Agent State Persistence

Phase 8 infra spec. No existing coverage — start from zero.

Doc 25 covers discovery agent behaviors (what agents do). Doc 27 covers Realtime session state
(how collab sessions broadcast events). Neither covers **durable agent memory** — how an agent
accumulates knowledge about a user across invocations and carries context between sessions.

---

## 1. State Layer Model

Agents currently have access to one stateful primitive: `mh.kv_set` / `mh.kv_get`, which stores
simple key-value pairs scoped to `(owner_id, agent_id)` in the `lua_agent_kv` table. This is
sufficient for user preferences and simple counters, but falls short for:

- Remembering which suggestions have already been shown to the user (deduplication across weeks)
- Tracking the evolution of a user's style profile as their collabs and quests develop
- Carrying a session-specific decision timeline across multiple agent invocations within one
  collab session

Phase 8 defines three state layers:

### Layer 1 — Ephemeral (Already Exists)

`mh.kv_set(key, value)` / `mh.kv_get(key)` from `api/lua-agent/run.py`.

- Scope: `(owner_id, agent_id)` key-value pairs in `lua_agent_kv`
- Persistence: indefinite (until agent deletes the key or user uninstalls agent)
- Use for: simple counters, preference flags, last-run timestamps
- Limit: values are strings, no nested structure

This layer is unchanged in Phase 8. It remains the lightest way to persist scalar state.

### Layer 2 — User-Scoped Durable State (New)

`agent_state_user` table. Stores a structured JSONB blob representing everything the agent
has learned about a specific user over time.

Use for: suggestion history, inferred style profile, rejected candidate IDs, accepted quest
patterns. This is the agent's "long-term memory" about the user.

### Layer 3 — Session-Scoped Durable State (New)

`agent_state_session` table. Stores the agent's working context for a specific collab session.

Use for: which tracklist edits have been proposed so far, which stems have been suggested,
the sequence of decisions made by participants so far. This state is meaningful only while
the session is active; after the session ends it becomes an audit artifact.

---

## 2. Schema

### 2.1 `agent_state_user`

```sql
CREATE TABLE IF NOT EXISTS agent_state_user (
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id      TEXT    NOT NULL,
  state_json    JSONB   NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, agent_id),
  CONSTRAINT agent_state_user_size CHECK (
    octet_length(state_json::text) <= 65536  -- 64KB
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_state_user_agent
  ON agent_state_user (agent_id);
```

**RLS:**
```sql
ALTER TABLE agent_state_user ENABLE ROW LEVEL SECURITY;

-- Users can read and delete their own state
CREATE POLICY "user own state" ON agent_state_user
  FOR ALL USING (user_id = auth.uid());

-- Agent runtime (service role) bypasses RLS to write state
-- No additional policy needed; service role bypasses RLS
```

### 2.2 `agent_state_session`

```sql
CREATE TABLE IF NOT EXISTS agent_state_session (
  session_id    UUID    NOT NULL REFERENCES collab_sessions(id) ON DELETE CASCADE,
  agent_id      TEXT    NOT NULL,
  state_json    JSONB   NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, agent_id),
  CONSTRAINT agent_state_session_size CHECK (
    octet_length(state_json::text) <= 65536
  )
);
```

**RLS:**
```sql
ALTER TABLE agent_state_session ENABLE ROW LEVEL SECURITY;

-- Participants of the session can read session state
CREATE POLICY "session participant read" ON agent_state_session
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collab_session_participants csp
      WHERE csp.session_id = agent_state_session.session_id
        AND csp.profile_id = auth.uid()
    )
  );

-- Only service role can write session state (agent runtime)
```

### 2.3 `agent_events` (Append-Only Audit Log)

```sql
CREATE TABLE IF NOT EXISTS agent_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      TEXT    NOT NULL,
  user_id       UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id    UUID    REFERENCES collab_sessions(id) ON DELETE SET NULL,
  event_type    TEXT    NOT NULL,
  payload       JSONB   NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_user
  ON agent_events (user_id, agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_events_session
  ON agent_events (session_id, created_at DESC);
```

**RLS:**
```sql
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own agent events (for audit/transparency)
CREATE POLICY "user own events" ON agent_events
  FOR SELECT USING (user_id = auth.uid());

-- Service role writes via agent runtime; no additional INSERT policy for anon
```

`event_type` values: `suggestion_shown`, `suggestion_accepted`, `suggestion_rejected`,
`quest_proposed`, `session_joined`, `session_state_saved`, `user_state_saved`, `error`.

---

## 3. State Lifecycle

**When to write state:**

| Trigger | Write action | Table |
|---|---|---|
| User accepts a suggestion | Append `candidate_id` to `state_json.accepted` | `agent_state_user` |
| User rejects a suggestion | Append `candidate_id` to `state_json.rejected_ids` | `agent_state_user` |
| Agent detects new genre pattern | Update `state_json.inferred_genres` | `agent_state_user` |
| Quest milestone completed | Record milestone in `state_json.quest_history` | `agent_state_user` |
| Session participant joins | Initialize session state | `agent_state_session` |
| Tracklist edit proposed | Append to `state_json.proposed_edits` | `agent_state_session` |
| Session ends | Freeze session state (no further writes) | `agent_state_session` |

**When NOT to write state:**
- Do not write on every agent invocation if no meaningful state changed.
- Do not write on `on_schedule` triggers unless the agent actually produced output.
- Do not write search results or API responses (these are ephemeral — recompute on next run).

**Maximum `state_json` size:** 64KB, enforced by CHECK constraint. If the state approaches
this limit, the agent should prune old entries (e.g. keep only last 100 `rejected_ids`).

---

## 4. Lua API Contracts

Four new `mh.*` functions to add to `api/lua-agent/run.py` and the Lua sandbox.

### 4.1 `mh.agent_state_load_user() → table`

Loads the user-scoped state for the current `(owner_id, agent_id)` pair. Returns an empty
Lua table `{}` if no state exists yet (fail-open).

```python
# run.py implementation sketch
def agent_state_load_user(owner_id: str, agent_id: str) -> dict:
    resp = supabase_admin.table('agent_state_user') \
        .select('state_json') \
        .eq('user_id', owner_id) \
        .eq('agent_id', agent_id) \
        .maybe_single() \
        .execute()
    return resp.data['state_json'] if resp.data else {}
```

Lua usage:
```lua
local state = mh.agent_state_load_user()
local rejected = state.rejected_ids or {}
```

### 4.2 `mh.agent_state_save_user(state_table)`

Upserts the user-scoped state. Merges `state_table` with the existing state (shallow merge at
top-level keys). Rate limit: at most once per agent invocation. Throws an error (agent stops)
if serialized state exceeds 64KB.

```python
def agent_state_save_user(owner_id: str, agent_id: str, state: dict) -> None:
    import json
    payload_str = json.dumps(state)
    if len(payload_str.encode('utf-8')) > 65536:
        raise RuntimeError('agent_state_user: state_json exceeds 64KB limit')
    supabase_admin.table('agent_state_user').upsert({
        'user_id': owner_id,
        'agent_id': agent_id,
        'state_json': state,
        'updated_at': 'now()',
    }, on_conflict='user_id,agent_id').execute()
```

Lua usage:
```lua
state.rejected_ids = rejected
state.last_run_at = mh.now()
mh.agent_state_save_user(state)
```

### 4.3 `mh.agent_state_load_session(session_id: string) → table`

Loads session-scoped state for `(session_id, agent_id)`. Returns `{}` if no state exists.
`session_id` must be a UUID string. Only available when the agent is invoked in a session
context (trigger provides `context.session_id`).

```python
def agent_state_load_session(session_id: str, agent_id: str) -> dict:
    resp = supabase_admin.table('agent_state_session') \
        .select('state_json') \
        .eq('session_id', session_id) \
        .eq('agent_id', agent_id) \
        .maybe_single() \
        .execute()
    return resp.data['state_json'] if resp.data else {}
```

Lua usage:
```lua
-- agent receives session_id from trigger context
local session_state = mh.agent_state_load_session(context.session_id)
local proposed = session_state.proposed_edits or {}
```

### 4.4 `mh.agent_state_save_session(session_id: string, state_table)`

Upserts session-scoped state. Same size limit as user state.

Lua usage:
```lua
session_state.proposed_edits = proposed
mh.agent_state_save_session(context.session_id, session_state)
```

---

## 5. Collaborative Editing Integration

When a Collab Cartographer or any other agent is invoked during a collab session, the trigger
context contains `session_id`. The agent workflow:

```lua
-- 1. Load session-scoped state
local state = mh.agent_state_load_session(context.session_id)
local already_suggested = state.suggested_tracks or {}

-- 2. Load user-scoped preferences
local prefs = mh.agent_state_load_user()
local rejected_ids = prefs.rejected_ids or {}

-- 3. Generate suggestions, filter out already_suggested and rejected_ids
local candidates = mh.get_scene_peers(10)
local fresh = {}
for _, c in ipairs(candidates) do
  if not already_suggested[c.id] and not rejected_ids[c.id] then
    table.insert(fresh, c)
  end
end

-- 4. Broadcast suggestion via Realtime (session:{id}:state channel)
if #fresh > 0 then
  mh.notify_session(context.session_id, {
    type = "agent_suggestion_added",
    agent_id = mh.agent_id,
    suggestions = { fresh[1], fresh[2] }
  })
  -- Mark as suggested to avoid re-surfacing this session
  already_suggested[fresh[1].id] = true
  already_suggested[fresh[2].id] = true
end

-- 5. Save updated session state
state.suggested_tracks = already_suggested
mh.agent_state_save_session(context.session_id, state)
```

**`mh.notify_session(session_id, payload)`** — new Lua function (Phase 8 addition to run.py)
that broadcasts a `session:{id}:state` Supabase Realtime event from the server side. The
frontend `CollabSessionRoom` subscribes to this channel and renders agent suggestions in the
chat overlay with a `⚡` prefix.

---

## 6. Privacy Constraints

1. `agent_state_user.state_json` must never contain another user's private data. If the agent
   queries for similar artists (which returns other users' nodes), it may store only node IDs
   and public attributes (display name, genre), not private profile fields.

2. Users can view their own `agent_state_user` rows via a "Agent memory" panel in the agent
   detail view (Claude Code task). They can delete their state at any time; the API route
   `DELETE /api/agents/:id/state` calls `supabase_admin.table('agent_state_user').delete()`.

3. `agent_events` rows are retained for 90 days, then purged by a pg_cron job.

4. The session state (`agent_state_session`) is readable by all session participants (per RLS
   above). This is intentional — the agent's session reasoning should be transparent to all
   collaborators. Do not include any off-session user data in session state.

---

## 7. Example: Collab Cartographer State After 3 Invocations

```json
{
  "last_run_at": "2026-06-01T09:00:00Z",
  "last_candidates": [
    { "id": "node-uuid-1", "name": "Ana Helder", "genre": "techno" },
    { "id": "node-uuid-2", "name": "Phase Fatale", "genre": "dark techno" },
    { "id": "node-uuid-3", "name": "Clouds", "genre": "minimal" }
  ],
  "shown_to_user": ["node-uuid-1", "node-uuid-2", "node-uuid-3"],
  "accepted": ["node-uuid-1"],
  "rejected_ids": ["node-uuid-2"],
  "inferred_genres": ["techno", "dark techno"],
  "run_count": 3,
  "last_precision": 0.33
}
```

Over time, `inferred_genres` expands or contracts based on accepted collab patterns, making
future suggestions progressively better without requiring the agent to re-query the full
artist graph.

---

## 8. Codex Handoff

**Migration (e.g. 068):**

- Create `agent_state_user`, `agent_state_session`, `agent_events` tables with RLS as above.
- Add pg_cron job for `agent_events` 90-day retention purge:
  ```sql
  SELECT cron.schedule(
    'purge-agent-events',
    '0 3 * * *',
    $$DELETE FROM agent_events WHERE created_at < now() - interval '90 days'$$
  );
  ```

**`api/lua-agent/run.py`:**
- Add 4 Python implementations (`agent_state_load_user`, `agent_state_save_user`,
  `agent_state_load_session`, `agent_state_save_session`) as Lua-callable functions.
- Add `notify_session(session_id, payload)` using Supabase Realtime Broadcast from the server:
  `supabase_admin.realtime.broadcast(channel=f'session:{session_id}:state', event='broadcast', payload=payload)`
- Wire all 5 functions into the Lua sandbox `mh` table before script execution.

**Claude Code handoff:**
- "Agent memory" panel in agent detail view: shows `agent_state_user.state_json` for the
  active agent, with a "Clear memory" button → `DELETE /api/agents/:id/state`.
