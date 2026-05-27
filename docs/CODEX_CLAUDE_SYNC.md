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
