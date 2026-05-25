# Patterns

Named architectures used across the codebase. Cross-references the
[anthropic/claude-cookbooks](https://github.com/anthropics/claude-cookbooks)
`patterns/agents/` recipes so a new contributor can search for the
industry term and find the local implementation.

## Orchestrator-workers — the Lua agent layer

> **Cookbook:** `patterns/agents/orchestrator_workers.ipynb`

A central coordinator picks up a task and farms it out to specialised
workers; the orchestrator owns dispatch + result collection, the workers
own the actual computation.

In MixHive:

```
Postgres trigger ─► dispatch_lua_event(owner_id, trigger, payload)
                              │  [orchestrator — supabase/migrations/013]
                              ▼  pg_net.http_post
                  /api/lua-agent/run.py
                              │  [worker pool — Lupa sandbox]
                              ▼  record_lua_agent_run() RPC
                  lua_agent_runs                [audit log]
```

- Orchestrator: `dispatch_lua_event(p_owner_id, p_trigger_type, p_event_payload)`
  in `supabase/migrations/013_lua_agents.sql`.
- Workers: each enabled row in `lua_agents` whose `(owner_id, trigger_type)`
  matches the dispatched event. Their actual code runs in
  `api/lua-agent/run.py`.
- Async + non-blocking: dispatch uses `pg_net.http_post`, so the
  originating transaction never waits on Lua.

## Routing — Postgres-side event fan-out

> **Cookbook:** `patterns/agents/` (routing section)

A request lands and gets directed to different downstream pipelines based
on its shape. In MixHive, every social write fans out to `feed_events`
(per follower) and to `notifications` (for the mix owner / parent comment
author / mentioned users / followed DJs). Each downstream consumer
(client subscription, Lua agent dispatch, future email digest) reads from
its dedicated stream rather than racing on the source tables.

Where to look:
- `supabase/migrations/001_mixhive_schema.sql` — original notification
  + feed_events fan-out.
- `supabase/migrations/004_feed_algorithm.sql` — `handle_mix_publish_feed`
  routes uploads to each follower's feed.
- `supabase/migrations/009_reposts_in_feed.sql` — feed routing extended
  to include reposts via UNION ALL.

## Multi-LLM parallelisation — N/A today

> **Cookbook:** `patterns/agents/` (parallelisation section)

No model-call parallelism in the codebase yet. Earmarked for the planned
`mh.ai(prompt)` Lua extension once a free-tier inference plane (e.g.,
self-hosted Ollama in front of a small Llama / Qwen model on the GTX
1080) is wired up.

## Evaluator-optimiser — planned for Lua agent test cases

> **Cookbook:** `patterns/agents/evaluator_optimizer.ipynb`

A separate component evaluates whether an output meets criteria and
loops the evaluation back into refinement.

Future application (Phase L++): each `lua_agents` row gets an optional
`test_cases jsonb[]` column where each entry is `{ event, expect }`.
The Test-run button in `src/pages/Agents.tsx` runs every case, compares
captured `mh.notify` / `mh.print` output against the expected text, and
surfaces pass/fail counts inline. Schema sketch:

```sql
alter table public.lua_agents
  add column test_cases jsonb default '[]'::jsonb;
-- each element: { "name": string, "event": jsonb, "expect_notify": string[] }
```

Not implemented yet — the doc is here so a future contributor knows the
intended shape before adding ad-hoc test infrastructure.

## Sub-agent isolation (Claude Code)

The repo ships two Claude Code skills under `.claude/skills/`:

- `mixhive-migration` — invoked any time a session touches
  `supabase/migrations/`. Enforces idempotent / NOT-VALID-VALIDATE patterns.
- `mixhive-lua-agent` — invoked when working on the Lua agent layer or
  `mh.*` API. Documents the orchestrator-workers pattern and security
  stance (Lupa >= 2.8, attribute_filter).

The `/lint-fix` slash command (`.claude/commands/lint-fix.md`) drives
the warn → error promotion loop on the jsx-a11y migration.
