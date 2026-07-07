# MixHive Next Phase Todo List

Use this as the terminal-facing task checklist for GPT/Codex/Claude Code work.

## 0. Guardrails

- [x] Keep `mixhive.app` DNS out of scope.
- [x] Use Vercel deployment URLs and `https://mixhive.vercel.app` for readiness.
- [x] Do not commit secrets or `.env.local`.
- [x] Do not edit existing migrations.
- [x] Run verification before deploy.

## 1. GPT-Codex - Integration

- [x] Add `/dashboard` route.
- [x] Add dashboard nav entry for authenticated users.
- [x] Expand `scripts/browser_smoke.py` route matrix.
- [ ] Keep CI/Lighthouse aligned with Next.js.
- [x] Review Claude/UI changes for conflicts.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run local browser smoke after Claude's latest changes.
- [x] Deploy to Vercel.
- [x] Run production HTTP smoke after deploy is READY.
- [ ] Run production browser smoke (Playwright not available in this environment).

## 2. GPT-Product - Feature Specs

- [ ] Write Creator Dashboard v1 acceptance criteria.
- [ ] Write Discover/Feed v1.5 acceptance criteria.
- [ ] Write Profile Hive Cell v1 acceptance criteria.
- [ ] Write Upload Release Flow v1 acceptance criteria.
- [ ] Write Creator Radar v1 acceptance criteria.
- [ ] Write Lua Agents creator-superpower acceptance criteria.

## 3. GPT-UI / Claude Code - Experience

- [x] Upgrade `/discover` into a multi-lane exploration hub.
- [x] Improve `/feed` tab hierarchy and empty states.
- [x] Upgrade profile pages into premium hive-cell pages.
- [x] Improve upload form hierarchy and progress states.
- [x] Improve agent gallery cards and onboarding copy.
- [x] Verify 320px mobile layout (code-level audit; real-device QA recommended).
- [x] Remove route-level console warnings (code-level audit; runtime console QA recommended).

## 4. GPT-Backend - Schema/API Planning

- [ ] Determine dashboard metrics derivable from existing tables.
- [ ] Specify featured/pinned profile mix data shape.
- [ ] Specify collaboration status and creator role data shape.
- [ ] Specify events v1 schema and RLS.
- [ ] Specify reports/moderation v1 schema and RLS.
- [ ] Prepare migration notes for Codex approval.

## 5. GPT-QA - Verification

- [x] Smoke `/`.
- [x] Smoke `/feed`.
- [x] Smoke `/discover`.
- [x] Smoke `/search`.
- [x] Smoke `/dashboard`.
- [x] Smoke `/setup`.
- [x] Smoke `/upload`.
- [x] Smoke `/agents/gallery`.
- [x] Smoke `/mix/test-id`.
- [x] Smoke `/buzz/test-id`.
- [x] Smoke `/u/test-user`.
- [ ] Check 320 x 740 (requires Playwright/browser).
- [ ] Check 390 x 844 (requires Playwright/browser).
- [ ] Check 768 x 900 (requires Playwright/browser).
- [ ] Check 1440 x 900 (requires Playwright/browser).
- [ ] Verify no unhandled console errors (requires browser).
- [ ] Verify no 404/500 asset failures (requires browser).
- [ ] Verify WebGL fallback does not block clicks (requires browser).

## 6. Launch Readiness

- [ ] README reflects Next.js, not Vite.
- [ ] CLAUDE.md reflects current ownership split.
- [ ] AGENT_BUILD_PLAN and GPT_TASK_PLAN are current.
- [x] Latest Vercel deployment is `READY`.
- [x] `https://mixhive.vercel.app` returns HTTP 200.
