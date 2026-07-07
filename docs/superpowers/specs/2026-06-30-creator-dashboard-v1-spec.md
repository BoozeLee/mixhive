# Creator Dashboard v1 — Acceptance Criteria

**Date:** 2026-06-30 · **Status:** Spec ready for implementation

## Context

The `/dashboard` route already exists and loads user mixes, analytics, activity, and agents. This spec turns it into a focused **Hive Growth OS** first screen that answers three questions for a creator:

1. How am I growing? (metrics)
2. What should I do next? (next-best actions)
3. What can I automate? (agent suggestions)

## Scope

### In scope

- Header with date range selector (7d / 30d / 90d / all-time).
- Four summary stat cards: plays, likes, followers, mixes.
- Top mix card with plays + engagement sparkline.
- Recent fan activity list (plays, likes, follows, comments).
- Next-best-actions list personalized from profile/mix state.
- Suggested automation agents (1–3 cards) with one-click fork.
- Mobile-first responsive layout.

### Out of scope

- Real-time WebSocket updates (poll on focus is acceptable).
- Revenue/gear-sales deep analytics.
- Custom date range picker (preset buttons only).

## Acceptance criteria

### First screen

- Authenticated users land on `/dashboard` and see a header "Hive Growth OS" plus their display name.
- A default date range of **30d** is selected.
- A loading skeleton covers the whole view until the first data fetch completes.

### Primary action

- The top-right primary button is **Upload mix** → navigates to `/upload`.
- Secondary action: **View profile** → navigates to `/u/:me`.

### Empty state

- If the user has zero mixes, show `EmptyState` with icon `music`:
  - Title: "Your hive is waiting"
  - Body: "Upload your first mix to unlock growth metrics and fan activity."
  - CTA: "Upload mix" → `/upload`.
- If analytics return empty but mixes exist, show a soft empty state inline per widget instead of a full-page block.

### Loading state

- Use `SkeletonFeed`-style skeletons for the stat cards, top mix, activity, and actions.
- Skeletons disappear together once all dashboard data resolves.

### Error state

- If any dashboard query fails, show a non-blocking inline error banner at the top.
- Failed widgets show a retry button that re-fetches only that widget's data.
- The upload CTA remains visible during errors.

### Mobile behavior

- At 320px: stat cards form a 2×2 grid; top mix is full-width; activity and actions stack vertically.
- Date range selector becomes a horizontal scroll pill row.
- Touch targets ≥ 44×44 for all buttons and selectors.

### Data dependencies

- `getMixesByDj(userId)` — own mixes.
- `getProfileAnalytics(userId, mixes)` — aggregate analytics.
- `getUserActivity(userId)` — recent events.
- `listAgents()` — own agents for automation summary.
- `STARTER_AGENTS` — suggestions filtered by user state.

## Success metrics

- Dashboard loads in < 2s on a 4G connection.
- All widgets render without layout shift after data loads.
- No console errors on `/dashboard`.
