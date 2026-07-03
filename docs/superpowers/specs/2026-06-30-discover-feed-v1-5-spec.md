# Discover / Feed v1.5 — Acceptance Criteria

**Date:** 2026-06-30 · **Status:** Spec ready for implementation

## Context

`/discover` was upgraded to a multi-lane hub and `/feed` got tab hierarchy and empty states. This spec hardens the v1.5 behavior: consistent lanes, better personalization signals, and a unified "Rising" surface across both routes.

## Scope

### In scope

- `/discover` lanes: Trending, Fresh Drops, Top Creators, Buzzing Now, AI Band, Popular Genres.
- `/feed` tabs: Following, Trending, Latest.
- New **Rising** lane/tab: mixes gaining momentum in the last 24h.
- Following feed personalization for logged-in users.
- Genre/scene quick filters on Discover.
- Unified empty states and loading skeletons.

### Out of scope

- Algorithmic recommendation engine v2.
- Infinite scroll on Discover lanes (horizontal paging kept as-is).
- Full search integration (Discover links to `/search` for deep search).

## Acceptance criteria

### First screen

- `/discover` shows the Music Discovery header and the first lane (Trending) immediately.
- `/feed` defaults to **Following** for authenticated users, **Trending** for guests.

### Primary action

- Discover: tapping a mix or creator card navigates to detail.
- Feed: the **Upload mix** button is visible in the hero strip for authenticated users.

### Empty state

- Discover lane with no items shows a compact inline empty card instead of a full-page block.
- Feed tab empty states (already implemented) remain:
  - Following → "Find creators" CTA.
  - Trending → "Retry" CTA.
  - Latest → "Upload a mix" CTA.

### Loading state

- Discover shows horizontal skeleton lanes matching card widths.
- Feed shows `SkeletonFeed` on initial load; tab switches show a subtle tab-level spinner.

### Error state

- Failed Discover lane shows a retry inline without collapsing other lanes.
- Failed Feed tab shows `EmptyState` with retry action.

### Mobile behavior

- Discover lanes are horizontally scrollable with snap; scroll buttons hide on touch devices.
- Feed tab bar scrolls horizontally if labels don't fit.
- Mix cards in Discover are 160px wide; in Feed they are full-width.

### Data dependencies

- `getTrendingMixes`, `getRecentMixes`, `getTopDJs`, `getLatestBuzzes`, `getAIAgentLeaderboard`, `getPopularGenres`.
- New: `getRisingMixes(limit)` RPC for 24h momentum.

## Success metrics

- Both routes render in < 2s on 4G.
- No horizontal overflow at 320px.
- Following feed updates within 5s of a new follow/mix upload.
