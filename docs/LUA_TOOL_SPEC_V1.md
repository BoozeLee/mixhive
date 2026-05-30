# MixHive Lua Tool Spec — Version 1

**Status:** Active  
**Runtime:** wasmoon (Lua 5.4 WASM) via `src/server/lua-agents/`  
**Updated:** 2026-05-30

This document is the canonical reference for every tool available inside a MixHive strategic Lua agent.
Feed it verbatim into AI code-gen system prompts so generated agents use correct signatures and never hallucinate tools.

---

## Entry Point

Every agent script must define a top-level `run(ctx)` function. The runner calls it and captures `_result`.

```lua
function run(ctx)
  -- ctx fields: profile_id, agent_id, run_id, trigger, dry_run, context
  return {
    status        = "ok",        -- "ok" | "needs_approval" | "error" | "skipped"
    suggestions   = {},          -- list of suggestion(...)
    tasks         = {},          -- list of task(...)
    notifications = {},          -- list of notify(...)
  }
end
```

---

## Sandbox Globals

These globals are injected before `run` is called. Do not try to `require` anything — `require` is nil.

| Global | Type | Purpose |
|---|---|---|
| `ctx` | table | Run context (see fields below) |
| `mixhive` | table | Tool catalogue — call as `mixhive["tool.name"](args):await()` |
| `mh_log(...)` | function | Append strings to the run log |
| `mh_get_logs()` | function | Returns the current log list (rarely needed) |
| `suggestion(type, payload, confidence, rationale, requiresApproval)` | function | Build a suggestion record |
| `task(title, priority?, dueDate?)` | function | Build a task record |
| `notify(subject, body, channel?, ctaUrl?)` | function | Build a notification record |
| `state_get(key)` | function | Get a persisted agent state value (string \| nil) |
| `state_set(key, value, ttl_seconds?)` | function | Set a persisted agent state value |

### ctx fields

```lua
ctx.profile_id  -- string UUID: the artist being analysed
ctx.agent_id    -- string: e.g. "profile_coach"
ctx.run_id      -- string UUID: this specific run
ctx.trigger     -- string: e.g. "cron:daily", "event:user_request"
ctx.dry_run     -- boolean: true → do not write to DB
ctx.context     -- table | nil: caller-supplied extra data
```

### suggestion(type, payload, confidence, rationale, requiresApproval)

```lua
local s = suggestion(
  "bio_rewrite",                              -- string: suggestion type
  { proposed = "new bio text" },             -- table: payload
  0.85,                                       -- number 0.0–1.0: confidence
  "Bio score 32/100 — too short",            -- string: rationale shown to user
  true                                        -- boolean: true = user must approve
)
```

### task(title, priority?, dueDate?)

```lua
local t = task("Upload a mix", "high", "2026-06-15")
-- priority: "low" | "medium" | "high"  (default: "medium")
-- dueDate: ISO date string or nil
```

### notify(subject, body, channel?, ctaUrl?)

```lua
local n = notify("Profile score: 45/100", "Improve your bio.", "in_app", "/profile/edit")
-- channel: "in_app" | "email" | "push"  (default: "in_app")
```

---

## Tool Reference (`mixhive["tool.name"](args):await()`)

All tools are async. Always call `:await()` on the result.

### Database Tools

#### `db.read(table, filters, limit?)`

```lua
local rows = mixhive["db.read"]("profiles", { location = "Brussels" }, 10):await()
-- table:   string — table name
-- filters: table  — key=value equality filters (all ANDed)
-- limit:   number — max rows (default 20, max 100)
-- returns: list of row tables, empty list if none
```

#### `db.read_one(table, filters)`

```lua
local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
-- returns: row table or nil
```

#### `db.insert(table, row)`

```lua
local inserted = mixhive["db.insert"]("ai_suggestions", { ... }):await()
-- returns: the inserted row
```

#### `db.upsert(table, row)`

```lua
mixhive["db.upsert"]("press_kits", { profile_id = ctx.profile_id, ... }):await()
-- returns: true
```

#### `db.update(table, filters, updates)`

```lua
mixhive["db.update"]("mixes", { id = mix_id }, { analyzed = true }):await()
-- returns: true
```

#### `db.rpc(fn, params?)`

```lua
local venues = mixhive["db.rpc"]("find_candidate_venues", {
  p_genres = {"techno","acid"},
  p_city   = "Brussels",
  p_limit  = 10
}):await()
-- fn:     string — Postgres function name (only allowlisted RPCs work)
-- params: table  — named parameters
-- returns: list of rows
```

**Allowlisted RPC functions:** `find_candidate_venues`, `match_ai_embeddings`

---

### LLM Tools

#### `llm.call(prompt, model?, system?)`

```lua
local text = mixhive["llm.call"](
  "Write a 3-sentence bio for " .. profile.display_name,
  "sonnet",   -- "haiku" | "sonnet" | "opus" | "gpt-4o-mini" | "gpt-4o"
  "You are a music industry assistant."
):await()
-- returns: string
```

#### `llm.json(prompt, schemaDesc, model?)`

```lua
local data = mixhive["llm.json"](
  "Score this profile. " .. details,
  '{"score":number,"reason":string}',
  "haiku"
):await()
-- schemaDesc: string describing expected JSON shape
-- returns: table (parsed JSON)
```

---

### Vector / Embedding Tools

#### `vector.embed(text)`

```lua
local vec = mixhive["vector.embed"]("techno DJ from Ghent"):await()
-- returns: list of numbers (1536-dim embedding)
```

#### `vector.search(embeddingOrText, entityType, limit?, threshold?)`

```lua
local similar = mixhive["vector.search"](bio_text, "profile", 10, 0.65):await()
-- embeddingOrText: string (will be embedded) or pre-computed vector list
-- entityType: string — "profile" | "mix" | "opportunity" | "venue"
-- limit:     number  — max results (default 10)
-- threshold: number  — cosine similarity threshold (default 0.65)
-- returns: list of { entity_id, entity_type, similarity, metadata }
```

#### `vector.upsert(entityType, entityId, text, ownerId?)`

```lua
mixhive["vector.upsert"]("profile", ctx.profile_id, bio_text, ctx.profile_id):await()
-- returns: true
```

---

### Audio Tools

#### `audio.features(mixId)`

```lua
local feat = mixhive["audio.features"](mix_id):await()
-- returns: audio_features row (bpm, key, mood, energy, danceability, …) or nil
```

#### `audio.tracklist(mixId)`

```lua
local tracks = mixhive["audio.tracklist"](mix_id):await()
-- returns: list of mix_tracks rows ordered by start_sec
```

#### `audio.trigger_analysis(mixId)`

```lua
local ok = mixhive["audio.trigger_analysis"](mix_id):await()
-- Queues async audio analysis job. Returns boolean (true = queued).
```

---

### HTTP Tools (allowlisted origins only)

#### `http.get(url, headers?)`

```lua
local body = mixhive["http.get"]("https://vi.be/api/..."):await()
-- Only these origins are allowed: vi.be, ra.co, api.bandsintown.com,
-- api.audd.io, api.acrcloud.com, www.musicboard-berlin.de
-- returns: parsed JSON table or raw string
```

#### `http.post(url, body, headers?)`

```lua
local resp = mixhive["http.post"]("https://ra.co/api/...", { query = "..." }):await()
-- returns: parsed JSON table
```

---

### Mythic Graph Tools

#### `mythic.quest.get_active(profileId)`

```lua
local quests = mixhive["mythic.quest.get_active"](ctx.profile_id):await()
-- returns: list of active quest rows (up to 5), ordered by updated_at desc
```

#### `mythic.graph.query(params)`

```lua
local edges = mixhive["mythic.graph.query"]({
  from_node_id = ctx.profile_id,
  edge_type    = "performed_at",
  limit        = 20,
}):await()
-- params: { from_node_id?, to_node_id?, edge_type?, limit? }
-- returns: list of mythic_edge rows
```

#### `mythic.yield.get_summary(profileId, days?)`

```lua
local summary = mixhive["mythic.yield.get_summary"](ctx.profile_id, 180):await()
-- returns: { outcomes: list, count: number }
```

---

### State Tools (persistent across runs)

```lua
local last = state_get("last_run_ts")
state_set("last_run_ts", os.date and os.date("!%Y-%m-%d") or "2026-01-01")
state_set("cooldown_key", "1", 3600)  -- expires after 1 hour
```

State is scoped per `(agent_id, profile_id)`. Keys: max 128 chars. Values: max 4096 chars. Max 256 keys per agent+profile.

---

## Stripped Globals (unavailable for security)

`debug`, `io`, `os`, `package`, `require`, `collectgarbage` — all nil.

---

## Approved Tables for `db.read` / `db.read_one`

Agents may read from any of these tables (service-role, all rows visible):

`profiles`, `mixes`, `mix_tracks`, `audio_features`, `opportunities`, `venues`,
`mythic_nodes`, `mythic_edges`, `quests`, `quest_milestones`, `ai_suggestions`,
`ai_embeddings`, `press_kits`, `notifications`, `buzzes`, `follows`,
`collab_sessions`, `collab_session_members`, `moderation_signals`

Agents may write (`db.insert`, `db.upsert`, `db.update`) only to:

`ai_suggestions`, `press_kits`, `mixes` (update only), `notifications`,
`moderation_signals`, `ai_embeddings`

---

## Example Agent Skeleton

```lua
-- my_agent.lua — MixHive Strategic Agent v1
-- Trigger: cron:daily | event:user_request
-- Tools:   db.read_one, llm.json, notify

function run(ctx)
  mh_log("my_agent start", ctx.profile_id)

  local profile = mixhive["db.read_one"]("profiles", { id = ctx.profile_id }):await()
  if not profile then
    return { status = "error", message = "profile not found",
             suggestions = {}, tasks = {}, notifications = {} }
  end

  -- ... agent logic ...

  return {
    status        = "ok",
    suggestions   = {},
    tasks         = {},
    notifications = {},
  }
end
```

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1 | 2026-05-30 | Initial canonical spec — all tools documented |
