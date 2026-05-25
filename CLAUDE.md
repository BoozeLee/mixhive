# CLAUDE.md — MixHive

Drop-in conventions for any Claude Code session opened inside this repo.

## What this is

MixHive is a DJ-first social music platform (Facebook × SoundCloud).
React 19 + TypeScript 6 (strict) + Vite 8 + react-router-dom v7, Supabase
(Postgres + Auth + Storage + RLS + Realtime), Vercel SPA + Vercel Python
function for the Lua agent runtime. Proprietary licence — the repo is
public for portfolio visibility only; see `LICENSE` and `NOTICE`.

## Key paths

- `src/lib/api.ts` — every server interaction (queries, mutations, RPCs)
- `src/lib/types.ts` — shared types + `parseMentions()`
- `src/lib/database.types.ts` — auto-generated from Supabase via
  `npm run db:types`. Don't hand-edit; regenerate after any migration.
- `src/lib/playerStore.tsx` — global persistent player context
- `src/lib/schemas.ts` — Zod validation schemas + `formatZodError()`
- `src/lib/agents.ts` + `src/lib/starter_agents.ts` — Lua agent client API
- `src/styles/tokens.ts` — colour / space / radius / fontSize / shadow / z
- `src/components/ui/` — Button, IconButton, Input, Textarea, Select,
  FileInput, Avatar, Modal. Prefer these over raw HTML form elements.
- `src/components/MixAgentHints.tsx` — `<details>`-based "Automate this"
  panel that surfaces Lua agents on MixDetail
- `supabase/migrations/NNN_*.sql` — numbered migrations, all idempotent
- `api/lua-agent/run.py` — Vercel Python serverless, Lupa-sandboxed Lua
- `docs/LUA_AGENTS.md` — full Lua sandbox reference (triggers, `mh.*` API,
  cron syntax, security)
- `docs/PATTERNS.md` — names the cookbook patterns the codebase uses

## Conventions

- **Styling**: tokens-only colours from `src/styles/tokens.ts`. No new
  inline hex codes. Mobile breakpoints live in `src/styles/global.css`.
- **Forms**: use `Input` / `Textarea` / `Select` / `FileInput` from
  `src/components/ui/`. They bind `id` ↔ `htmlFor` via `useId()` and
  accept `error` / `help` props that consume `formatZodError()` output.
- **Buttons**: real `<button>` or `IconButton` (which requires `label`).
  Never `<div onClick>`. The single seek-bar exception in `GlobalPlayer.tsx`
  has full keyboard + ARIA-slider support; do not copy that pattern.
- **Database**: every change ships as a new numbered migration. Idempotent
  DDL only (`if not exists`, `drop policy if exists`, `do $$ … end$$`
  for guarded blocks, `NOT VALID + VALIDATE` for new CHECKs). Never edit
  an existing migration.
- **RLS**: RLS stays on. Never disable. Service-role calls live in
  `api/lua-agent/run.py` only.
- **Migrations 010+ touch RLS, constraints, the Lua agent layer, and
  scheduled / public-sharing extensions** — read the headers before
  layering new ones in.

## Workflow

```bash
# Every change, in this order:
npx tsc --noEmit
npm run lint        # 0 errors required; warnings are OK while we ratchet
npm run build
git push origin main
gh run watch        # CI must land green
```

Branch protection on `main` requires 1 approving review + linear history.
Admin bypass is on for solo work. When a non-admin contributor joins,
they branch and PR; admins keep bypassing or open dummy PRs.

## Lua agent layer (orchestrator-workers pattern)

`dispatch_lua_event(owner_id, trigger_type, event_payload)` (defined in
migration 013) is the **orchestrator**. It looks up every enabled
`lua_agents` row matching `(owner_id, trigger_type)` and dispatches each
to the **worker** at `/api/lua-agent/run.py` via pg_net, which loads the
user-authored Lua, runs it in a Lupa sandbox, and writes the result back
via `record_lua_agent_run()`. Triggers fire from Postgres triggers on
follows / comments / likes / feed_events / notifications / mixes. The
six built-in starter templates live in `src/lib/starter_agents.ts` and
always render in `/agents/gallery` so a fresh install isn't empty.

## Don't

- Commit `.env*` (except `.env.example`).
- Add new inline hex codes — extend `src/styles/tokens.ts` instead.
- Disable RLS or use the service-role key from the browser.
- Introduce paid third-party APIs (zero budget; self-host or free tier
  only — see [[feedback_no_paid_apis]] in user memory).
- Edit an existing migration. Always add a new numbered one.
- Use `--no-verify` / `--force` on git without explicit instruction.

## Quick commands

| Command          | What it does                                          |
| ---------------- | ----------------------------------------------------- |
| `npm run dev`    | Vite dev server on http://localhost:5173              |
| `npm run build`  | `tsc -b && vite build`                                |
| `npm run lint`   | ESLint flat config (warns include the open a11y list) |
| `npm run analyze`| Bundle visualiser → `dist/bundle-stats.html`          |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` (CLI-linked) |
| `/lint-fix`      | Slash command — group lint warnings by rule + chip    |
