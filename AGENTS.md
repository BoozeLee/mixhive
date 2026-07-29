# AGENTS.md / SOUL.md - MixHive Session Summary

## Objective
Polish secondary route error/loading/empty states (Phase 2a), mobile overflow
audit at 320px (Phase 2b), and update DESIGN_SYSTEM.md (Phase 4).

## Important Details
- Stack: Next.js 16 App Router + React 19 + TypeScript 6 + React Router v7
  inside client bridge. Supabase, Vercel, Tailwind 4 CSS tokens.
- Mobile: stable at 320px, no horizontal overflow. Content width = 288px
  (320px - 16px * 2 padding).
- Submodule: `mixhive/` at `d659fa5d43a6e46b9e27e6495b139c333f7bcefe`. Push
  submodule first, then parent.
- User is @kilisan on GitHub. Basecamp project: "Thursdsay Hive Corp".
- DESIGN_SYSTEM.md lives at `docs/DESIGN_SYSTEM.md` — updated.
- Error handling pattern: `error` state + Retry button + inline danger banner.
- Loading pattern: `<LoadingSpinner size="lg" />` or `<SkeletonFeed />`.
- Empty state pattern: `<EmptyState iconKey="..." title="..." body="..." />`.
- 320px mobile pattern: `flexWrap: 'wrap'` on multi-item rows, text overflow
  protection (`overflow: hidden, textOverflow: ellipsis, whiteSpace: nowrap`),
  `wordBreak: 'break-word'` on message bubbles and notification text.

## Completed (Phase 1 - Critical Bug Fixes)
1. ArtStudio: added missing `tierLoading` state declaration.
2. Settings: replaced hardcoded "Free" with actual tier fetch.
3. Dashboard: top-level empty state for new users.

## Completed (Phase 10/12 UI fixes)
1. MixDetail: `.catch()` on `getMix()` to prevent infinite spinner.
2. Notifications: plain text → `<LoadingSpinner />`.
3. EventDetail: `/profile/` → `/u/` links.
4. HiveComposer: two-panel mobile layout at 768px breakpoint.

## Completed (Stripe subscription fixes)
1. PricingPage, Settings, ArtStudio: tier-aware subscription display.

## Completed (Phase 2a - Error/loading states for secondary routes)
All 10 files: Leaderboard, LiveRooms, Notifications, Messages,
MessageThread, MixAnalytics, BuzzDetail, AIBandDetail, AIBandIndex,
AgentTracks — added error state + catch + retry.

## Completed (Phase 2b - 320px mobile overflow audit)
**MixCard.tsx:** DJ name div — added `overflow: hidden, textOverflow:
ellipsis, whiteSpace: nowrap`.

**Feed.tsx:**
- TrendingNowPanel DJ name — added overflow protection.
- Tab bar container — added `overflow: hidden`.

**BuzzComposer.tsx:**
- Toolbar — added `flexWrap: 'wrap'`.
- AttachBadge — added `maxWidth: 100%, overflow: hidden` + text overflow.

**Notifications.tsx:** Text body — added `wordBreak: 'break-word'` + parent
`overflow: hidden`.

**Messages.tsx:** Header row — added `flexWrap: 'wrap'`.

**MessageThread.tsx:** Message bubbles — added `wordBreak: 'break-word'`.

**Upload.tsx:**
- Error banner — added `flexWrap: 'wrap'` + text overflow.
- Draft resume banner — added `flexWrap: 'wrap'`.

**UploadProgress.tsx:** Status row — added `flexWrap: 'wrap'` + text overflow.

**MixDetail.tsx:**
- Stats row — added `flexWrap: 'wrap'`.
- Action buttons — added `flexWrap: 'wrap'`.

## Completed (Phase 4 - DESIGN_SYSTEM.md update)
Added responsive patterns (320px mobile, flexWrap, text overflow, word-break),
error/loading/empty state patterns, and Phase 2 progress to the checklist.

## Relevant Files
- `src/components/MixCard.tsx` — DJ name overflow fix
- `src/views/Feed.tsx` — DJ name overflow + tab bar overflow
- `src/components/BuzzComposer.tsx` — toolbar flexWrap + AttachBadge overflow
- `src/views/Notifications.tsx` — wordBreak + overflow
- `src/views/Messages.tsx` — header flexWrap
- `src/views/MessageThread.tsx` — wordBreak on bubbles
- `src/views/Upload.tsx` — error banner + draft banner flexWrap
- `src/components/upload/UploadProgress.tsx` — flexWrap + overflow
- `src/views/MixDetail.tsx` — stats + action buttons flexWrap
- `docs/DESIGN_SYSTEM.md` — Phase 4 update
- `src/styles/tokens.ts` — design tokens

## Next
Basecamp progress update, then Phase 3/5.
