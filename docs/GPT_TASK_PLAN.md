# GPT Task Plan - MixHive Next Phase

This document splits the next MixHive build phase into GPT-owned task tracks.
It is intentionally separate from domain/DNS work; production readiness is
measured through Vercel deployment URLs and `https://mixhive.vercel.app`.

## Phase Objective

Build the first version of MixHive's **Hive Growth OS**: a creator-focused
operating layer that improves discovery, creator analytics, profile identity,
upload flow quality, collaboration, automation agents, and launch readiness.

## Operating Rules

- Codex is the integration owner.
- Claude Code is the product/UI owner.
- GPT-QA owns route, console, responsive, and acceptance checks.
- GPT-Backend owns schema/API planning, but Codex applies migrations.
- No agent works on `mixhive.app` DNS in this phase.
- No service-role secrets in browser code.
- No edits to existing migrations; new schema work must be a new numbered file.

## GPT-Codex Track

### Mission

Keep the repo shippable while implementing integration-heavy work.

### Primary Ownership

- `next.config.mjs`
- `vercel.json`
- `.github/workflows/*`
- `src/app/*`
- `src/MixHiveClient.tsx`
- `scripts/*`
- `package*.json`
- final deploy and smoke verification

### Tasks

- Add `/dashboard` to the route tree and wire it into desktop/mobile nav.
- Expand smoke coverage to include `/dashboard`, `/upload`, and profile/mix
  representative routes.
- Keep CI aligned with Next.js, not Vite.
- Review all GPT/Claude changes before deploy.
- Run final local and Vercel verification.

### Done Criteria

- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Browser smoke passes locally and against the Vercel deployment URL.
- Vercel deployment is `READY`.

## GPT-Product Track

### Mission

Turn the competitive research into product specs that make MixHive feel like a
creator growth platform, not only an upload/feed app.

### Tasks

- Specify Creator Dashboard v1:
  - growth metrics
  - top mixes
  - recent fan activity
  - next-best-action cards
  - suggested automation agents
- Specify Discover/Feed v1.5:
  - Following
  - Trending
  - Latest
  - Rising
  - genre/scene lanes
- Specify Profile Hive Cell v1:
  - featured mix
  - creator stats
  - badges
  - support/social links
  - tabs for Mixes, Playlists, Activity, Agents, Events, About
- Specify Upload Release Flow v1:
  - guided steps
  - draft/publish mental model
  - progress states
  - post-publish sharing and automation suggestions
- Specify Creator Radar v1:
  - role, genre, location, and collaboration status filters
  - lightweight contact/intent flow

### Done Criteria

- Each route has a clear first screen, primary action, empty state, loading
  state, error state, and mobile behavior.
- No feature depends on the deferred custom domain.

## GPT-UI / Claude Code Track

### Mission

Make the planned product surfaces feel premium, musical, responsive, and aligned
with the MIXHIVE cyber-hive identity.

### Primary Ownership

- `src/views/*`
- `src/components/*`
- `src/styles/tokens.ts`
- user-facing docs

### Tasks

- Polish `/discover` from a simple list into a multi-lane exploration hub.
- Polish `/feed` tabs and empty states.
- Upgrade profile pages into "hive cell" creator pages.
- Improve upload form hierarchy, progress, and recovery states.
- Improve agent gallery cards and onboarding copy.
- Eliminate route-level console warnings and mobile overflow.

### Done Criteria

- No horizontal overflow at 320px.
- Mobile dock and player never overlap content or each other.
- Buttons are keyboard-accessible.
- Empty/loading/error states are intentional and on-brand.

## GPT-Backend Track

### Mission

Prepare the minimum schema/API changes needed for next-phase features without
overbuilding.

### Tasks

- Draft schema/API plan for:
  - dashboard metric aggregates
  - featured/pinned profile mix
  - collaboration status and creator role
  - events v1
  - reports/moderation v1
- Decide which items can be derived from existing tables before adding schema.
- Write migration specs for Codex to implement only after approval.
- Update TypeScript type impact notes for each proposed schema change.

### Done Criteria

- Every schema change has a user-facing reason.
- RLS behavior is specified.
- Backward compatibility is preserved.

## GPT-QA Track

### Mission

Protect production readiness while the product expands.

### Tasks

- Maintain a route smoke matrix:
  - `/`
  - `/feed`
  - `/discover`
  - `/search`
  - `/dashboard`
  - `/upload`
  - `/agents/gallery`
  - `/mix/test-id`
  - `/u/test-user`
- Test viewports:
  - 320 x 740
  - 390 x 844
  - 768 x 900
  - 1440 x 900
- Track console/network issues by route.
- Verify WebGL fallback and reduced-motion behavior.
- Verify protected routes redirect cleanly for guests.

### Done Criteria

- No unhandled JS exceptions.
- No 404/500 asset failures.
- No incoherent overlap.
- Smoke output is clean or documented with a concrete external cause.

## Handoff Format

Each GPT track reports:

- changed files
- user-visible behavior changes
- commands run
- failures or blockers
- next recommended task

Codex then performs final integration and deploy verification.
