# Lua agents

MixHive ships a scripting layer that lets DJs / power users react to events on their own account with a snippet of [Lua](https://www.lua.org/). Use it to auto-welcome new followers, thank commenters, schedule a weekly digest post, filter spam, track top fans, or build custom recommendation logic.

## Runtime split

There are now two Lua layers:

- **User automation runtime:** the existing `/api/lua-agent/run.py` Python/Lupa sandbox executes user-authored `lua_agents` from the product UI. This remains the live user-facing automation path.
- **Strategic AI agent runtime:** `src/server/lua-agents/*` is the new Node/wasmoon Lua 5.4 VM pool for MIXHIVE-owned agents such as Profile Coach, Opportunity Match, Booking Scout, Press Kit, Grant Assistant, DJ Set Analyzer, and Scene Radar. The health probe is `/api/agents/wasmoon-test`.

The wasmoon runtime is additive. Do not migrate user-authored agents from Lupa until the tool whitelist, DB persistence, and RLS behavior have parity with the Python runtime.

```
event in Postgres ──► trigger fans out to matching agents
                              │
                              ▼ pg_net.http_post
                  ┌─────────────────────────────────┐
                  │  /api/lua-agent/run.py          │
                  │  Vercel Python · Fluid Compute  │
                  │  Lupa-sandboxed Lua runtime     │
                  └─────────────────────────────────┘
                              │
                              ▼ Supabase REST (as the agent owner)
                       side-effects: comment, post_buzz,
                       notify, follow, kv_set, …
```

## Why Lua

- Tiny grammar, predictable runtime — safe to give to non-engineers.
- Sandboxable: we can yank every dangerous global and only expose the surface we want.
- Lupa runs Lua *inside* the Python serverless function with no extra infrastructure.

## Triggers

| Trigger          | Fires when…                                              | Event payload keys                                          |
| ---------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `on_follow`      | Someone follows you                                      | `actor_id`, `created_at`                                    |
| `on_unfollow`    | Someone unfollows you                                    | `actor_id`                                                  |
| `on_mix_upload`  | A DJ you follow publishes a new mix                      | `actor_id`, `mix_id`, `title`, `genre_id`, `created_at`     |
| `on_comment`     | Someone comments on your mix                             | `actor_id`, `mix_id`, `comment_id`, `body`, `created_at`    |
| `on_reply`       | Someone replies to your comment                          | `actor_id`, `mix_id`, `comment_id`, `parent_id`, `body`     |
| `on_mention`     | You're @mentioned anywhere                               | `actor_id`, `source_type`, `source_id`, `context`           |
| `on_like`        | Someone likes your mix                                   | `actor_id`, `mix_id`, `created_at`                          |
| `on_repost`      | Someone reposts your mix                                 | `actor_id`, `mix_id`, `feed_event_id`                       |
| `on_schedule`    | Cron schedule fires (configure `cron_expr` on the agent) | `tick_at`, `cron`                                           |
| `manual`         | Only the **Test run** button invokes it                  | whatever you pass                                           |

Your script must define a top-level function whose name matches the trigger (`function on_follow(event) … end`). For `manual` agents the script runs top-to-bottom — no entry-point function needed.

## Sandbox API (`mh.*`)

### Identity

```lua
mh.agent_id    -- string: this agent's UUID
mh.owner_id    -- string: your user UUID
mh.trigger     -- string | nil: the trigger_type that fired
```

### Logging

```lua
mh.print(...)  -- captures to the runs log (stdout, max 8000 chars total)
```

### Read helpers

```lua
mh.get_mix(mix_id)                    -- table | nil
mh.get_profile(user_id)               -- table | nil
mh.get_mixes_by_user(user_id, limit?) -- list of published mixes (max 50)
mh.get_followers(user_id, limit?)     -- list of {follower_id, created_at} rows (max 100)
mh.get_following(user_id, limit?)     -- list of {following_id, created_at} rows (max 100)
mh.fetch_recent_mixes(limit?)         -- platform-wide recent published mixes (max 50)
```

### Social write actions

```lua
mh.comment(mix_id, body)       -- post a comment as you (max 1 per run, 1000 chars)
mh.delete_comment(comment_id)  -- delete a comment you wrote on your own mixes
mh.post_buzz(text)             -- post a buzz as you (max 1 per run, 500 chars)
mh.notify(message)             -- in-app notification to yourself (max 500 chars)
mh.follow(user_id)             -- follow (idempotent)
mh.unfollow(user_id)
mh.like(mix_id)                -- like (idempotent)
mh.unlike(mix_id)
mh.repost(mix_id)
mh.unrepost(mix_id)
```

### Persistent key-value store

Each agent gets an isolated KV namespace — keys are strings up to 128 chars, values up to 4096 chars, max 256 keys total. Use this for deduplication, rate-tracking, counters, and state between runs.

```lua
mh.kv_get(key)                          -- returns string or nil
mh.kv_set(key, value, ttl_seconds?)     -- upsert; omit ttl for no expiry
mh.kv_del(key)                          -- delete a key
mh.kv_list()                            -- returns array of {key, value, expires_at}
```

### JSON utilities

```lua
mh.json_encode(table)   -- Lua table → JSON string
mh.json_decode(str)     -- JSON string → Lua table
```

## Limits

| Limit                        | Default | Hard ceiling  |
| ---------------------------- | ------- | ------------- |
| Wall clock per run           | 2000ms  | 30000ms       |
| Memory                       | 8 MB    | 64 MB         |
| Script size                  | —       | 64 KB         |
| `mh.print` total bytes       | —       | 8000          |
| Comments per run             | —       | 1             |
| Buzzes per run               | —       | 1             |
| KV keys per agent            | —       | 256           |
| KV value length              | —       | 4096 chars    |
| KV key length                | —       | 128 chars     |

**Auto-disable:** An agent that fails 10 consecutive runs is automatically disabled. Fix the error and re-enable it from the editor.

## Example agents

### Welcome new followers (deduplicated with KV)

```lua
function on_follow(event)
  local key = "welcomed:" .. event.actor_id
  if mh.kv_get(key) then return end  -- already welcomed

  local actor = mh.get_profile(event.actor_id)
  mh.notify("👋 New follower: @" .. (actor and actor.username or event.actor_id))
  mh.kv_set(key, "1")
end
```

### Track top fans

```lua
function on_like(event)
  if event.actor_id == mh.owner_id then return end
  local key = "likes_from:" .. event.actor_id
  local count = tonumber(mh.kv_get(key) or "0") + 1
  mh.kv_set(key, tostring(count))
  if count == 5 then
    local fan = mh.get_profile(event.actor_id)
    mh.notify("⭐ @" .. (fan and fan.username or event.actor_id) .. " hit 5 likes!")
  end
end
```

### Auto-delete spam

```lua
local SPAM_WORDS = {"buy now", "free crypto", "dm me"}

local function is_spam(body)
  body = string.lower(body or "")
  for _, w in ipairs(SPAM_WORDS) do
    if string.find(body, w, 1, true) then return w end
  end
end

function on_comment(event)
  local hit = is_spam(event.body)
  if hit then
    pcall(mh.delete_comment, event.comment_id)
    mh.notify("Deleted spam (" .. hit .. ") on mix " .. event.mix_id)
  end
end
```

### Weekly stats digest

```lua
local function on_schedule(event)
  local mixes = mh.get_mixes_by_user(mh.owner_id, 5) or {}
  local lines = {}
  for i, m in ipairs(mixes) do
    table.insert(lines, i .. ". " .. m.title .. " — " .. (m.play_count or 0) .. " plays")
  end
  mh.notify("📊 Top mixes:\\n" .. table.concat(lines, "\\n"))
end
```

### JSON state across runs

```lua
local raw = mh.kv_get("state")
local state = raw and mh.json_decode(raw) or {count = 0}
state.count = state.count + 1
mh.kv_set("state", mh.json_encode(state))
mh.print("run #" .. state.count)
```

## Scheduled agents

Set `trigger_type = 'on_schedule'` and a 5-field `cron_expr` (UTC). A pg_cron job runs every minute (migration 015) and dispatches every scheduled agent whose expression matches the current minute. Supported syntax:

| Form          | Example       | Meaning                          |
| ------------- | ------------- | -------------------------------- |
| literal       | `0 9 * * 1`   | Mondays 09:00                    |
| range         | `0 9-17 * * *`| Every hour 9-17                  |
| step          | `*/15 * * * *`| Every 15 minutes                 |
| list          | `0 9,17 * * *`| 09:00 and 17:00 daily            |
| wildcard      | `* * * * *`   | Every minute (avoid!)            |

`@daily`, `@hourly` etc. are intentionally not supported — spell out the cron.

## Public agents & forking

Toggle the `is_public` checkbox in the editor to publish an agent to **`/agents/gallery`**. Visitors can browse every public agent, preview the code, and one-click fork it via the `fork_lua_agent(p_source_id, p_new_name)` RPC. Forks start disabled — you review the code, hit Enable, and you're live.

The `fork_count` on the original updates so creators can see which agents are popular.

## Security

We pin **Lupa >= 2.8** (the version that fully fixed CVE-2026-34444 — sandbox escape via attribute_filter bypass). The runtime adds belt-and-braces hardening on top:

- `attribute_filter=_deny_attribute` rejects every Python attribute access from inside Lua.
- `register_eval=False` blocks `load()` / `loadstring()`.
- `register_builtins=False` keeps Python builtins out of the Lua globals.
- The allow-list strips reflection primitives (`getmetatable`, `setmetatable`, `rawget`, `rawset`, `debug.*`) before user code runs.
- The MixHive stdlib only exposes plain callables; we never pass a Python object reference into Lua.
- Wall-clock is enforced via `SIGALRM`; stdout is hard-capped at 8KB.
- Social writes are limited per-run (1 comment, 1 buzz) to prevent runaway fanout.
- KV is capped at 256 keys and 4096 bytes per value per agent.

If you find an escape, please report privately via [SECURITY.md](../.github/SECURITY.md) — do not file a public issue.

## Operator setup

The Python runtime needs the following secrets configured on the Vercel project:

| Variable                       | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `SUPABASE_URL`                 | Project URL (no `NEXT_PUBLIC_` prefix for the Python runtime).    |
| `SUPABASE_SERVICE_ROLE_KEY`    | Service-role key. Required to read agents and record runs.         |
| `LUA_RUNTIME_SHARED_SECRET`    | Optional override. Defaults to the service-role key.               |

And these Postgres settings, so the database trigger can call the runtime:

```sql
alter database postgres set app.lua_runtime_url  = 'https://<your-vercel-domain>/api/lua-agent/run';
alter database postgres set app.service_role_key = '<service role key>';
```

`pg_net` must be enabled (it's pre-installed on Supabase — toggle under Database → Extensions).

## Migration history

| Migration | What it added                                       |
| --------- | --------------------------------------------------- |
| 013       | `lua_agents`, `lua_agent_runs`, `on_follow`, `on_comment`, `dispatch_lua_event` |
| 014       | `on_unfollow`, `on_mix_upload`, `on_like`, `on_repost`, `on_mention` |
| 015       | `on_schedule` via pg_cron + `cron_matches()`        |
| 016       | `is_public`, `fork_lua_agent()` RPC, fork gallery   |
| 033       | `agent_kv` table + KV RPCs, `on_reply` trigger, auto-disable after 10 consecutive errors, run log trim |
