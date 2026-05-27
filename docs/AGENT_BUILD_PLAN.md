# Dual-Agent Build Plan

This repo can be worked by Codex and Claude Code in parallel if ownership stays
clear.

## Codex Track

- Own Next/Vercel infrastructure, CI, deployment, and verification.
- Primary files:
  - `next.config.mjs`
  - `vercel.json`
  - `.github/workflows/*`
  - `src/app/*`
  - `src/MixHiveClient.tsx`
  - `scripts/*`
  - `package*.json`
- Run final gates before deploy:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build`
  - `npm run smoke -- --mock-supabase <url>`
- Deploy and verify with Vercel:
  - `vercel deploy --prod --yes`
  - `vercel inspect <deployment-url>`
  - `curl -I https://mixhive.vercel.app`

## Claude Code Track

- Own product/UI polish, accessibility, and user-facing docs.
- Primary files:
  - `src/views/*`
  - `src/components/*`
  - `src/styles/tokens.ts`
  - `docs/*`
  - `CLAUDE.md`
- Focus areas:
  - mobile overflow and 320px layout resilience
  - empty, loading, and error states
  - keyboard/focus behavior
  - route-level console warning cleanup
  - MIXHIVE cyber-hive visual consistency

## Shared Files

Coordinate before editing:

- `src/App.tsx`
- `src/lib/supabase.ts`
- `src/styles/global.css`

## Deferred Scope

External DNS for `mixhive.app` and `www.mixhive.app` is intentionally deferred.
Use Vercel deployment URLs and `https://mixhive.vercel.app` for production
readiness until DNS is configured at the registrar.
