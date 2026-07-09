# Creator Studio Analytics 2.0 — Content Performance (P11 depth)

**Date:** 2026-07-09
**Status:** Approved design
**Owner lane:** Claude Code (`src/views/*`) — no Codex overlap

## Context

The creator Dashboard (`src/views/Dashboard.tsx`) already shows aggregate
plays/likes/comments/followers, a 6-point sparkline, the single top mix, recent
activity, next actions, and agents. `getProfileAnalytics()` already computes richer
fields the UI never renders: `topMixes[5]`, `genreDistribution`, `uploadFrequencyDays`.
Roadmap P11 lists "analytics 2.0" as remaining depth. This spec adds a **content
performance** view answering "which of my drops actually work?" using data already
loaded on the page — no new backend, migrations, or Codex-owned files.

## Scope (approved)

A new **"Content performance"** full-width section in `Dashboard.tsx`, placed after
the `ProfileCoachPanel` section, wrapped in the existing `HiveCard`. Two parts:

### 1. Sortable per-mix table
- One row per published mix from the `mixes` array **already in Dashboard state**
  (`getMixesByDj`). No new fetch.
- Columns: **Mix** (artwork thumb + title → `/mix/:id`), **Plays**, **Likes**,
  **Comments**, **Engagement %**.
- Engagement % = `(like_count + comment_count) / play_count`, rendered as a
  percentage; when `play_count === 0`, render `—` (no divide-by-zero).
- Column headers are real `<button>`s that toggle sort (asc/desc); default sort
  **Plays desc**. Active column shows a ▲/▼ indicator.
- The table lives inside an `overflow-x: auto` container so it scrolls **inside its
  card** at 320px — the page body never overflows (repo rule).
- Empty state (`HiveCard` copy) when the creator has no mixes.

### 2. Genre distribution
- Horizontal **share-of-catalog** bars from the already-computed
  `genreDistribution` (`{ name, count }[]`), sorted count desc.
- Per dataviz: magnitude-by-category → **single brand-gold hue**, varying bar
  length (not a multi-hue categorical palette; no palette validation required).
  Marks: 4px rounded data-end, recessive track, direct label per row
  (`genre · count · NN%`). Values are directly labeled and the table above is the
  table view, so no JS tooltip layer.

## Non-goals (YAGNI)
CSV export, date-range filters, new event tracking, per-mix time series.

## Reuse
- Data: `mixes` state + `analytics.genreDistribution` (both already present).
- UI: `HiveCard`, `src/styles/tokens.ts`, `react-router-dom` `Link`.
- Sorting is local component state over the in-memory `mixes` array.

## Brand / a11y
Tokens only (black/gold cyber-hive); keyboard-accessible sort buttons with
`aria-sort`; `prefers-reduced-motion` respected (bar width transition only);
stable at 320px with no page overflow.

## Verification
1. `npm run lint` (0 errors) · `npm run build` (passes).
2. Drive the Dashboard in a browser as a signed-in creator with real mixes:
   table renders, each column sort toggles correctly, engagement % computes (and
   `—` at 0 plays), genre bars match the catalog, no page overflow at 320px.
3. Ship: commit → PR → preview deploy on Vercel. Production promotion remains
   Codex's gate.
