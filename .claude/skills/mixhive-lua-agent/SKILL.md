---
name: mixhive-lua-agent
description: >
  REQUIRED when working on the Lua agent layer. Triggers: "Lua agent",
  "starter agent", "agent script", "mh." API calls (mh.get_mix,
  mh.comment, mh.notify, mh.follow, mh.like, mh.repost), trigger types
  (on_follow, on_comment, on_like, on_repost, on_mention, on_mix_upload,
  on_schedule, manual), dispatch_lua_event, lua_agents table, Lupa,
  /api/lua-agent/run.py, /agents page, /agents/gallery. Documents the
  orchestrator-workers pattern this layer implements and the canonical
  security stance.
---

# MixHive Lua agent skill

Architecture name — the **orchestrator-workers** pattern
(`patterns/agents/orchestrator_workers.ipynb` in the Anthropic cookbook):

```
Postgres trigger ─► dispatch_lua_event(owner_id, trigger, payload)   [orchestrator]
                              │
                              ▼ pg_net.http_post
                  /api/lua-agent/run.py     [worker pool — Lupa sandbox]
                              │
                              ▼ record_lua_agent_run() RPC
                  lua_agent_runs            [audit log]
```

## Key files

- `src/lib/agents.ts` — typed client (listAgents, createAgent, updateAgent,
  forkAgent, createFromStarter, testRunAgent, listRuns).
- `src/lib/starter_agents.ts` — six built-in templates with `defaultTemplateFor()`.
- `src/pages/Agents.tsx` — owner-side management UI.
- `src/pages/AgentsGallery.tsx` — public + starter library.
- `src/components/MixAgentHints.tsx` — discoverability on MixDetail.
- `api/lua-agent/run.py` — Lupa runtime + the `mh.*` stdlib.
- `supabase/migrations/013_lua_agents.sql` — schema + dispatcher.
- `supabase/migrations/014_lua_more_triggers.sql` — five extra event triggers.
- `supabase/migrations/015_lua_scheduled_agents.sql` — pg_cron-driven `on_schedule`.
- `supabase/migrations/016_lua_public_agents.sql` — is_public + fork RPC.
- `docs/LUA_AGENTS.md` — full reference (operator setup, triggers, `mh.*` API).

## Sandbox API (`mh.*`)

```
mh.agent_id / mh.owner_id / mh.trigger    -- string identity
mh.print(...) / mh.notify(message)        -- output channels
mh.get_mix(id) / mh.get_profile(id)        -- reads
mh.fetch_recent_mixes(limit)               -- list
mh.comment(mix_id, body)                   -- writes (1000-char cap)
mh.like(mix_id) / mh.unlike(mix_id)        -- idempotent
mh.repost(mix_id) / mh.unrepost(mix_id)    -- idempotent
mh.follow(user_id) / mh.unfollow(user_id)  -- idempotent
```

Plus `math`, `string`, `table`, `ipairs`, `pairs`, `pcall`, `xpcall`,
`tonumber`, `tostring`, `type`, `assert`, `error`. Reflection
primitives (`getmetatable`, `setmetatable`, `rawget`, `rawset`,
`debug.*`) are stripped before user code runs.

## Triggers

| Trigger          | Source                                          | Migration |
| ---------------- | ----------------------------------------------- | --------- |
| `on_follow`      | INSERT on follows                               | 013       |
| `on_comment`     | INSERT on comments                              | 013       |
| `on_unfollow`    | DELETE on follows                               | 014       |
| `on_mix_upload`  | INSERT on mixes (per follower fan-out)          | 014       |
| `on_like`        | INSERT on likes (excluding self-likes)          | 014       |
| `on_repost`      | INSERT on feed_events where type='repost'       | 014       |
| `on_mention`     | INSERT on notifications where type='mention'    | 014       |
| `on_schedule`    | pg_cron `run_due_lua_agents` every minute       | 015       |
| `manual`         | Test button / explicit API call                 | 013       |

## Security stance

**Lupa is pinned at >= 2.8** (CVE-2026-34444 — incomplete
attribute_filter enforcement in getattr/setattr; vulnerable range was
`<= 2.6`). The runtime ALSO sets `attribute_filter=_deny_attribute` as
belt-and-braces — every attribute access from inside Lua hard-fails.

Hard limits per run:
- 2000 ms default wall clock (configurable per agent, max 30 s).
- 8 MB default memory (configurable, max 64 MB).
- 64 KB script size.
- 8000 bytes stdout total.
- 1000 chars per comment.

`record_lua_agent_run()` is the only writeback path. Status values:
`ok | error | timeout | oom | denied`. The audit log is append-only and
RLS-gated to the owner.

## Operator setup

Required Vercel env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
optional `LUA_RUNTIME_SHARED_SECRET`. Required Postgres settings:

```sql
alter database postgres set app.lua_runtime_url  = 'https://<vercel>/api/lua-agent/run';
alter database postgres set app.service_role_key = '<service role key>';
```

`pg_net` must be enabled (Database → Extensions in the Supabase dashboard).
