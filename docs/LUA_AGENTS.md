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
mh.agent_id              -- string: this agent's ID
mh.owner_id              -- string: your user ID
mh.print(...)            -- stdout for the runs log
mh.get_mix(mix_id)       -- table | nil
mh.get_profile(user_id)  -- table | nil
mh.comment(mix_id, body) -- posts a comment as you (max 1000 chars)
mh.notify(message)       -- pushes an in-app notification to you (max 500 chars)
mh.follow(user_id)       -- follows the user as you
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
