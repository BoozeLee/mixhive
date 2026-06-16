# Codex / Claude Sync Notes

This file captures the non-deploy integration state so Codex and Claude Code can
continue without overwriting each other.

## Current Ownership

- Claude Code is actively handling the current Vercel deployment and owns the
  Buzz + Profile Setup product slice.
- Codex is staying off Vercel for now and only handling local integration,
  verification coverage, and handoff notes.

## Integrated Routes

- `/dashboard` - Codex creator growth dashboard.
- `/feed` - Claude Buzz composer/cards integrated with mix feed tabs.
- `/buzz/:id` - Claude Buzz detail and replies.
- `/setup` - Claude onboarding/profile setup flow.
- `/api/ai/generate-avatar` - authenticated AI avatar generation.
- `/api/ai/generate-bio` - authenticated AI bio generation.
- `/api/ai/suggest-genres` - authenticated AI genre suggestions.
- `/api/ai/generate-art-pro` - Pro gated hosted art generation.

## Shared Route Table

`src/App.tsx` currently includes all of the above routes. Treat it as shared:
coordinate before changing route paths, protection rules, or lazy imports.

## Verification Coverage

`scripts/browser_smoke.py` now includes both agent workstreams:

- core routes: `/`, `/feed`, `/discover`, `/search`
- creator routes: `/dashboard`, `/upload`, `/setup`
- content routes: `/mix/test-id`, `/buzz/test-id`, `/u/test-user`
- agent route: `/agents/gallery`

Run local smoke before any follow-up deploy:

```bash
npm run build
npm run preview -- -p 3004
npm run smoke -- --mock-supabase http://127.0.0.1:3004
```

## Handoff Rules

- Do not run a second deploy while another agent is deploying.
- Do not overwrite Claude-owned UI files unless fixing a verified integration
  blocker.
- Keep `mixhive.app` DNS deferred until the final launch step.
- If local verification fails, fix the smallest route or script issue first,
  then rerun `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

## Latest Local Audit

- `ProfileSetup` now sends the Supabase bearer token when calling the AI
  avatar and bio endpoints, matching the per-user AI key resolver.
- Avatar upload filenames now use `crypto.randomUUID()` instead of timestamps.
- `/api/ai/generate-avatar` returns a data URL so generated avatar previews are
  compatible with the current Content Security Policy.
- `.env.example` and README include the optional server-side AI keys:
  `OPENAI_API_KEY` and `HUGGINGFACE_API_KEY`.
- Local gates passed after the sync:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run build`
  - `npm run smoke -- --mock-supabase http://127.0.0.1:3024`

## Local Preview Static-Serving — Fixed (2026-06-16)

Found and fixed while doing a real-browser check of the Phase 16 XP/reputation UI.

- **Root cause:** `npm run preview` used `next start`, which does **not** work with
  `output: 'standalone'` (next.config.mjs) — it serves `/_next/static/chunks/*.js` as
  `Content-Type: text/plain` / 500 → `ChunkLoadError`, so the client never hydrates. A standalone
  build must be served by its own `.next/standalone/server.js`, run **from the standalone root**
  with `.next/static` and `public` assembled alongside it (exactly the Dockerfile's COPY layout).
- **Fix:** `preview` now runs `node scripts/preview.mjs`, which copies `.next/static` +
  `public` into `.next/standalone/` and launches `server.js` from there. Verified:
  `curl -I .../_next/static/chunks/<x>.js` → `application/javascript`, and the app hydrates.
  `npm run preview -- -p <port>` still works. `output: 'standalone'` is unchanged (deploy-safe).
- **Verification tooling:** `npm run visual` (`scripts/visual_smoke.mjs`) — bundled-Chromium
  hydrated screenshot + horizontal-overflow + console-error check at 1440 and 320 px. Uses
  `bypassCSP: true` and waits on `#main-content`, so it needs no system Chrome.
  Usage: `node scripts/visual_smoke.mjs <baseURL> <route...>`.
- **Config (dev-only):** added `'unsafe-eval'` to `script-src` **only** when
  `NODE_ENV !== 'production'` so `next dev` can run in a real local browser. Production CSP is
  byte-for-byte unchanged.
- **Env note:** this sandbox has no outbound network, so Supabase DNS fails
  (`ERR_NAME_NOT_RESOLVED`) and real data can't load locally; populated-UI verification used the
  served prod build plus sample data in an isolated component harness.
