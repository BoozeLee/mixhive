# Lua agents — production pipeline verification

A runbook to confirm the user-automation pipeline is fully wired on production.
The code is deployed and tested; what this checks is the **operator wiring** the
code can't self-verify: Vercel env, Postgres settings, and `pg_net`.

Pipeline: `event in Postgres → trigger → dispatch_lua_event() → pg_net.http_post → /api/lua-agent/run → record_lua_agent_run()`.

If any layer below is unset, triggers silently never dispatch (no error surfaces
to users — runs simply never appear).

---

## Layer 1 — Runtime is deployed ✅ (already verified)

```bash
curl -s https://mixhive.vercel.app/api/lua-agent/run
# Expect: {"ok":true,"runtime":"mixhive-lua-agent","stdlib_version":"3"}
```

Confirmed green on prod at time of writing.

## Layer 2 — Vercel env vars

The Python runtime reads these (no `NEXT_PUBLIC_` prefix):

```bash
vercel env ls production | grep -E 'SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|LUA_RUNTIME_SHARED_SECRET'
```

- `SUPABASE_URL` — **required**
- `SUPABASE_SERVICE_ROLE_KEY` — **required** (reads agents, records runs)
- `LUA_RUNTIME_SHARED_SECRET` — optional; defaults to the service-role key. If
  set, the Postgres side (Layer 4) must send the **same** value.

## Layer 3 — Signed round-trip (proves auth + execution)

Pick a real agent id you own, then (replace `$SECRET` with
`LUA_RUNTIME_SHARED_SECRET`, or the service-role key if that var is unset):

```bash
curl -s -X POST https://mixhive.vercel.app/api/lua-agent/run \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"<AGENT_UUID>","triggered_by":"manual","event":{},"test":true}'
# Expect: {"agent_id":"...","status":"ok","duration_ms":<n>,"stdout":[...],"error":null}
```

- `401 {"error":"unauthorized"}` → the `Bearer` secret doesn't match the
  runtime's `RUNTIME_SHARED_SECRET`. Fix Layer 2 / Layer 4 to agree.
- `status:"ok"` with `test:true` means it executed **without** persisting a
  writeback run — safe to run repeatedly.

## Layer 4 — Postgres settings (the usual missing piece)

Run in the Supabase SQL editor:

```sql
-- Must both return non-null:
select current_setting('app.lua_runtime_url', true)  as runtime_url,
       current_setting('app.service_role_key', true) as service_key_set;

-- pg_net must be installed/enabled:
select extname, extversion from pg_extension where extname = 'pg_net';
```

If `runtime_url` is null, set them (service role key must match Layer 2):

```sql
alter database postgres set app.lua_runtime_url  = 'https://mixhive.vercel.app/api/lua-agent/run';
alter database postgres set app.service_role_key = '<service role key>';
-- Settings apply to NEW connections — no existing session sees them until reconnect.
```

Enable `pg_net` under Database → Extensions if the extension query is empty.

## Layer 5 — End-to-end dispatch smoke

With Layers 1–4 green, fire a real dispatch and confirm a run lands:

```sql
-- Manually dispatch to your own enabled agents for a trigger, e.g. on_follow:
select dispatch_lua_event('<YOUR_OWNER_UUID>', 'on_follow',
                          jsonb_build_object('actor_id','<SOME_ACTOR_UUID>'));

-- Within a few seconds, a row should appear:
select agent_id, triggered_by, status, duration_ms, created_at
from   lua_agent_runs
order  by created_at desc
limit  5;
```

`status` values: `ok | error | timeout | oom | denied`. Any row proves the full
loop (trigger → pg_net → runtime → writeback) works.

For scheduled agents, confirm the minute cron is registered:

```sql
select jobname, schedule, active from cron.job where jobname ilike '%lua%';
```

---

## Green checklist

- [ ] Layer 1 — `GET /api/lua-agent/run` returns the health JSON
- [ ] Layer 2 — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set in Vercel prod
- [ ] Layer 3 — signed POST returns `status:"ok"`
- [ ] Layer 4 — `app.lua_runtime_url` + `app.service_role_key` non-null; `pg_net` present
- [ ] Layer 5 — a `lua_agent_runs` row appears after a dispatch
- [ ] (scheduled) — a `%lua%` cron job is `active`

Layers 4–5 require Supabase DB access (Codex/operator). Layers 1–3 are runnable
from any shell with the runtime secret.
