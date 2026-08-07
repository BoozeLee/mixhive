# AGENTS.md - MixHive

Drop-in conventions for any OpenCode session opened inside this repo.

## Project

MixHive is a DJ-first social music platform: Facebook x SoundCloud for DJs,
producers, rave organizers, visual artists, and underground culture creators.
The app has been migrated from Vite to Next.js App Router. Next serves a
catch-all bridge at `src/app/[[...slug]]/page.tsx`, then the client app uses
React Router v7 for the existing route tree under `src/views`.

Current stack:

- Next.js 16 App Router + React 19 + TypeScript 6 strict
- React Router v7 inside the client bridge
- Supabase for Postgres, Auth, Storage, RLS, and Realtime
- Vercel production deploys, plus a Python serverless Lua agent runtime
- Tailwind 4 tokens/CSS plus local cyber-hive styling in `src/app/mixhive.css`
- Three.js backdrop with CSS fallback

The external `mixhive.app` DNS task is intentionally deferred. Build and deploy
against Vercel deployment URLs and `https://mixhive.vercel.app`.

## Agent Ownership

Codex owns infrastructure and integration:

- `next.config.mjs`, `vercel.json`, `.github/workflows/*`
- `src/app/*`, `src/MixHiveClient.tsx`, package scripts, smoke scripts
- Vercel deploys, production smoke checks, and final merge/deploy review

Claude Code owns product/UI polish:

- `src/views/*`
- `src/components/*`
- `src/styles/tokens.ts`
- user-facing docs and `CLAUDE.md` when instructions drift

OpenCode owns QA, security, and developer experience:

- `scripts/browser_smoke.py`, `scripts/mixhive-test.mjs`, `scripts/test.js`
- `package.json`, `package-lock.json`
- `SECURITY.md`, `README.md`, `docs/**`
- `.github/workflows/*` (maintenance bumps, lint/test changes)
- `CLAUDE.md` and this file when governance drift occurs

Shared files require coordination before edits:

- `src/App.tsx`
- `src/lib/supabase.ts`
- `src/styles/global.css`

If OpenCode finds an infra/config issue, write it down for Codex instead of
patching infra directly. If OpenCode finds a product/UI issue, write it down
for Claude Code instead of patching UI directly.

## Key Paths

- `src/app/[[...slug]]/page.tsx` - Next catch-all bridge into the client app
- `src/MixHiveClient.tsx` - client bootstrap, Sentry init, top error boundary
- `src/App.tsx` - React Router route tree and global shell
- `src/views/` - routed screens
- `src/components/` - reusable UI, player, nav, hive components
- `src/components/CyberHiveBackdrop.tsx` - Three.js backdrop and fallback
- `src/lib/api.ts` - server interactions, queries, mutations, RPCs
- `src/lib/types.ts` - shared app types and `parseMentions()`
- `src/lib/database.types.ts` - generated Supabase types; do not hand-edit
- `src/lib/playerStore.tsx` - global persistent audio player context
- `src/lib/schemas.ts` - Zod schemas and `formatZodError()`
- `src/lib/agents.ts` + `src/lib/starter_agents.ts` - Lua agent client API
- `src/styles/tokens.ts` - color, space, radius, fontSize, shadow, z tokens
- `src/app/mixhive.css` - brand shell, honeycomb, landing, and Next CSS
- `scripts/browser_smoke.py` - headless browser route/console/overflow smoke
- `api/lua-agent/run.py` - Vercel Python serverless Lua worker
- `supabase/migrations/NNN_*.sql` - numbered idempotent migrations
- `docs/LUA_AGENTS.md` - Lua sandbox reference
- `docs/PATTERNS.md` - local cookbook patterns

## Conventions

- Keep UI consistent with the black/gold cyber-hive brand. Use restrained,
  premium, high-contrast motion; avoid layout clutter and overlapping text.
- Use tokenized colors from `src/styles/tokens.ts` or existing CSS variables in
  `src/app/mixhive.css`. Do not introduce random one-off hex colors.
- Use existing form components from `src/components/ui/` before raw controls.
- Buttons must be real `<button>` elements or `IconButton` with a label.
- Keep mobile layouts stable at 320px width. No horizontal overflow.
- Respect `prefers-reduced-motion`; do not make WebGL required for usability.
- Do not disable RLS or use a service-role key from browser code.
- Do not edit existing migrations. Add a new numbered migration only if schema
  work is explicitly required.
- Do not commit `.env*` files except `.env.example`.
- Do not add paid third-party APIs.

## Workflow

Run checks in this order before handoff:

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run smoke -- --mock-supabase http://127.0.0.1:<port>
```

For local production smoke:

```bash
npm run build
npm run preview -- -p 3002
npm run smoke -- --mock-supabase http://127.0.0.1:3002
```

For Vercel production verification, Codex runs:

```bash
vercel deploy --prod --yes
vercel inspect <deployment-url>
npm run smoke -- --mock-supabase https://<deployment-url>
curl -I https://mixhive.vercel.app
```

## OpenCode Task Card

When asked to continue QA/Security/DevEx work, focus on:

- smoke script maintenance and route coverage in `scripts/*`
- dependency hygiene in `package.json` and `package-lock.json`
- `SECURITY.md` updates and dependency audit findings
- `.github/workflows/*` maintenance bumps for CI health
- `README.md` and `docs/**` accuracy
- `CLAUDE.md` and `AGENTS.md` governance drift
- lint/test/build health without changing product behavior

Report back with:

- changed files
- security/QA findings
- commands run and any failures
- recommendations for Claude Code or Codex if product/infra issues are found

## Quick Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production Next build |
| `npm run preview` | Serve the built Next app |
| `npm run lint` | ESLint flat config |
| `npm run smoke -- --mock-supabase <url>` | Browser smoke across core routes/viewports |
| `npm run analyze` | Bundle analysis build |
| `npm run db:types` | Regenerate Supabase database types |
