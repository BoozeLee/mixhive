# MixHive Next Phase Todo List

Use this as the terminal-facing task checklist for GPT/Codex/Claude Code work.

## 0. Guardrails

- [ ] Keep `mixhive.app` DNS out of scope.
- [ ] Use Vercel deployment URLs and `https://mixhive.vercel.app` for readiness.
- [ ] Do not commit secrets or `.env.local`.
- [ ] Do not edit existing migrations.
- [ ] Run verification before deploy.

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
- [ ] Deploy to Vercel. Claude currently owns this active deploy.
- [ ] Run production browser smoke after Claude's deploy is READY.

## 2. GPT-Product - Feature Specs

- [ ] Write Creator Dashboard v1 acceptance criteria.
- [ ] Write Discover/Feed v1.5 acceptance criteria.
- [ ] Write Profile Hive Cell v1 acceptance criteria.
- [ ] Write Upload Release Flow v1 acceptance criteria.
- [ ] Write Creator Radar v1 acceptance criteria.
- [ ] Write Lua Agents creator-superpower acceptance criteria.

## 3. GPT-UI / Claude Code - Experience

- [ ] Upgrade `/discover` into a multi-lane exploration hub.
- [ ] Improve `/feed` tab hierarchy and empty states.
- [ ] Upgrade profile pages into premium hive-cell pages.
- [ ] Improve upload form hierarchy and progress states.
- [ ] Improve agent gallery cards and onboarding copy.
- [ ] Verify 320px mobile layout.
- [ ] Remove route-level console warnings.

## 4. GPT-Backend - Schema/API Planning

- [ ] Determine dashboard metrics derivable from existing tables.
- [ ] Specify featured/pinned profile mix data shape.
- [ ] Specify collaboration status and creator role data shape.
- [ ] Specify events v1 schema and RLS.
- [ ] Specify reports/moderation v1 schema and RLS.
- [ ] Prepare migration notes for Codex approval.

## 5. GPT-QA - Verification

- [ ] Smoke `/`.
- [ ] Smoke `/feed`.
- [ ] Smoke `/discover`.
- [ ] Smoke `/search`.
- [ ] Smoke `/dashboard`.
- [ ] Smoke `/setup`.
- [ ] Smoke `/upload`.
- [ ] Smoke `/agents/gallery`.
- [ ] Smoke `/mix/test-id`.
- [ ] Smoke `/buzz/test-id`.
- [ ] Smoke `/u/test-user`.
- [ ] Check 320 x 740.
- [ ] Check 390 x 844.
- [ ] Check 768 x 900.
- [ ] Check 1440 x 900.
- [ ] Verify no unhandled console errors.
- [ ] Verify no 404/500 asset failures.
- [ ] Verify WebGL fallback does not block clicks.

## 6. Launch Readiness

- [ ] README reflects Next.js, not Vite.
- [ ] CLAUDE.md reflects current ownership split.
- [ ] AGENT_BUILD_PLAN and GPT_TASK_PLAN are current.
- [ ] Latest Vercel deployment is `READY`.
- [ ] `https://mixhive.vercel.app` returns HTTP 200.

## 7. OpenCode - QA / Security / DevEx

- [x] Run `npm audit --audit-level moderate` and document findings.
- [x] Apply `npm audit fix` for non-breaking patches.
- [x] Update `SECURITY.md` with audit history and remaining risks.
- [ ] Resolve remaining React Router CSRF bypass (breaking change required — defer to maintenance window).
- [ ] Verify `npm outdated` against `package.json` ranges and close stale ranges.
- [ ] Review `.github/workflows/*` for stale actions and least-privilege permissions.
- [ ] Verify `scripts/browser_smoke.py` covers all core routes at 320px/390px/768px/1440px.
- [ ] Verify `scripts/mixhive-test.mjs` covers API health and asset smoke.
- [ ] Update `README.md` build/run instructions if drift is found.
- [ ] Confirm `AGENTS.md` and `CLAUDE.md` ownership table stays in sync.
