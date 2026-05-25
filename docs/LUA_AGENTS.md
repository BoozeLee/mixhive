# Lua agents

MixHive ships a tiny scripting layer that lets DJs / power users react to events on their own account with a snippet of [Lua](https://www.lua.org/). Use it to auto-welcome new followers, thank commenters, schedule a weekly digest post, filter spam, or wire up custom recommendation logic.

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
                       side-effects: comment,
                       notify, follow, …
```

## Why Lua

- Tiny grammar, predictable runtime — safe to give to non-engineers.
- Sandboxable: we can yank every dangerous global and only expose the surface we want.
- Lupa runs Lua *inside* the Python serverless function with no extra infrastructure.

## Triggers

| Trigger          | Fires when…                                              | Event payload keys                                       |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `on_follow`      | Someone follows you                                      | `actor_id`, `created_at`                                 |
| `on_unfollow`    | Someone unfollows you                                    | `actor_id`                                               |
| `on_mix_upload`  | A DJ you follow publishes a new mix                      | `actor_id`, `mix_id`, `created_at`                       |
| `on_comment`     | Someone comments on your mix                             | `actor_id`, `mix_id`, `comment_id`, `body`, `created_at` |
| `on_reply`       | Someone replies to your comment                          | `actor_id`, `mix_id`, `parent_id`, `body`                |
| `on_mention`     | You're @mentioned anywhere                               | `actor_id`, `source_type`, `source_id`                   |
| `on_like`        | Someone likes your mix                                   | `actor_id`, `mix_id`                                     |
| `on_repost`      | Someone reposts your mix                                 | `actor_id`, `mix_id`, `feed_event_id`                    |
| `on_schedule`    | Cron schedule fires (configure `cron_expr` on the agent) | `tick_at`                                                |
| `manual`         | Only the **Test run** button or another agent invokes it | whatever you pass                                        |

Your script must define a top-level function whose name matches the trigger (`function on_follow(event) … end`). For `manual` agents the script runs top-to-bottom — no entry-point function needed.

## Sandbox API (`mh.*`)

```lua
mh.agent_id                   -- string: this agent's ID
mh.owner_id                   -- string: your user ID
mh.trigger                    -- string | nil: the trigger that fired

mh.print(...)                 -- stdout for the runs log
mh.get_mix(mix_id)            -- table | nil
mh.get_profile(user_id)       -- table | nil
mh.fetch_recent_mixes(limit)  -- list of recent published mixes (max 50)

mh.comment(mix_id, body)      -- posts a comment as you (max 1000 chars)
mh.notify(message)            -- in-app notification to you (max 500 chars)
mh.follow(user_id)            -- follow the user (idempotent)
mh.unfollow(user_id)          -- unfollow
mh.like(mix_id)               -- like (idempotent)
mh.unlike(mix_id)             -- unlike
mh.repost(mix_id)             -- repost
mh.unrepost(mix_id)           -- un-repost
```

Also available from standard Lua: `math`, `string`, `table`, `ipairs`, `pairs`, `pcall`, `xpcall`, `tonumber`, `tostring`, `type`, `assert`, `error`, `select`, `next`, `unpack`. Everything else (`os.execute`, `io.*`, `require`, `dofile`, `load`, `loadstring`, network primitives) is stripped before your code runs.

## Limits

| Limit                  | Default | Hard ceiling |
| ---------------------- | ------- | ------------ |
| Wall clock per run     | 2000ms  | 30000ms      |
| Memory                 | 8 MB    | 64 MB        |
| Script size            | —       | 64 KB        |
| `mh.print` total bytes | —       | 8000         |
| Comments per run       | 1 (sanity) | 1            |

A run that hits a limit is recorded with status `timeout` / `oom` / `denied` and the agent's `error_count` bumps. After 10 consecutive errors a future migration will auto-disable the agent.

## Example agents

### Welcome new followers
```lua
function on_follow(event)
  local actor = mh.get_profile(event.actor_id)
  mh.notify("New follower: @" .. actor.username)
end
```

### Thank every commenter
```lua
function on_comment(event)
  local actor = mh.get_profile(event.actor_id)
  mh.comment(event.mix_id, "Thanks for the feedback, @" .. actor.username .. "!")
end
```

### Spam filter — auto-reply with a warning, never call out to mh.delete()
```lua
local function is_spam(body)
  body = string.lower(body)
  for _, word in ipairs({"buy now", "free crypto", "dm me"}) do
    if string.find(body, word, 1, true) then return true end
  end
  return false
end

function on_comment(event)
  if is_spam(event.body) then
    mh.notify("Possible spam from @" .. event.actor_id .. " on mix " .. event.mix_id)
  end
end
```

## Scheduled agents

Set `trigger_type = 'on_schedule'` and a 5-field `cron_expr` (UTC). A pg_cron job runs every minute (migration 015) and dispatches every scheduled agent whose expression matches the current minute. Supported syntax:

| Form          | Example       | Meaning                          |
| ------------- | ------------- | -------------------------------- |
| literal       | `0 9 * * 1`   | Mondays 09:00                    |
| range         | `0 9-17 * * *`| Every hour 9-17                  |
| step          | `*/15 * * * *`| Every 15 minutes                 |
| list          | `0 9,17 * * *`| 09:00 and 17:00 daily            |
| wildcard      | `* * * * *`   | Every minute (don't actually)    |

`@daily`, `@hourly` etc. are intentionally not supported — they tend to surprise people. Spell out the cron.

## Public agents & forking

Toggle the `is_public` checkbox in the editor to publish an agent to **`/agents/gallery`**. Visitors can browse every public agent, preview the code, and one-click fork it via the `fork_lua_agent(p_source_id, p_new_name)` RPC. Forks start disabled — you review the code, hit Enable, and you're live.

The `fork_count` on the original updates so creators can see which agents are catching on.

## Security

We pin **Lupa >= 2.8** (the version that fully fixed CVE-2026-34444 — sandbox escape via attribute_filter bypass). The runtime adds belt-and-braces hardening on top:

- `attribute_filter=_deny_attribute` rejects every Python attribute access from inside Lua.
- `register_eval=False` blocks `load()` / `loadstring()`.
- `register_builtins=False` keeps Python builtins out of the Lua globals.
- The allow-list strips reflection primitives (`getmetatable`, `setmetatable`, `rawget`, `rawset`, `debug.*`) before user code runs.
- The MixHive stdlib only exposes plain callables; we never pass a Python object reference into Lua.
- Wall-clock is enforced via `SIGALRM`; stdout is hard-capped at 8KB.

If you find an escape, please report privately via [SECURITY.md](../.github/SECURITY.md) — do not file a public issue.

## Operator setup

The Python runtime needs the following secrets configured on the Vercel project:

| Variable                       | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `SUPABASE_URL`                 | Project URL, same as `VITE_SUPABASE_URL` (no `VITE_` prefix here). |
| `SUPABASE_SERVICE_ROLE_KEY`    | Service-role key. Required to read agents and record runs.         |
| `LUA_RUNTIME_SHARED_SECRET`    | Optional override. Defaults to the service-role key.               |

And these Postgres settings, so the database trigger can call the runtime:

```sql
alter database postgres set app.lua_runtime_url    = 'https://<your-vercel-domain>/api/lua-agent/run';
alter database postgres set app.service_role_key   = '<service role key>';
```

`pg_net` must be enabled (it's pre-installed on Supabase but you toggle it in the dashboard under Database → Extensions).
