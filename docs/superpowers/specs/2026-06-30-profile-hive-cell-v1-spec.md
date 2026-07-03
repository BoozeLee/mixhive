# Profile Hive Cell v1 — Acceptance Criteria

**Date:** 2026-06-30 · **Status:** Spec ready for implementation

## Context

Profile pages (`/u/:handle`) were upgraded to a premium hive-cell layout with a header, featured mix hero, and 8 URL-synced tabs. This spec captures the acceptance criteria so the view is consistent and performant across auth states.

## Scope

### In scope

- Profile header: banner, avatar, display name, handle, bio, stats, actions, social links.
- Featured mix hero for a pinned/featured mix.
- 8 tabs: Activity, Mixes, Sets, Playlists, Releases, Collaborations, Stats, Agents.
- Per-tab empty states.
- Edit-profile flow for own profile.
- Follow/unfollow for other profiles.

### Out of scope

- Full messaging from profile (link only).
- Merchandise tab (deferred to monetization phase).

## Acceptance criteria

### First screen

- `/u/:handle` loads the profile header and the active tab's content.
- Default tab is **Activity** when no `?tab=` query param is present.
- Tab state is reflected in the URL (`?tab=mixes`).

### Primary action

- Own profile: **Edit profile** opens an inline modal or navigates to `/settings/profile`.
- Other profile: **Follow** / **Following** toggle with loading state.
- A secondary **Share profile** button copies the current URL.

### Empty state

- Each tab shows a contextual empty state:
  - Mixes → "No mixes yet".
  - Sets → "No live sets recorded".
  - Playlists → "No public playlists".
  - Releases → "No releases yet".
  - Collaborations → "No collaborations yet".
  - Stats → "Stats will appear once you have plays".
  - Agents → "No agents deployed".

### Loading state

- Header shows a skeleton banner and avatar circle.
- Tab content shows `SkeletonFeed` or `SkeletonGrid` matching the tab layout.
- Tab bar remains interactive while content loads.

### Error state

- If the user handle does not exist, show a 404-style `EmptyState` with CTA to Discover.
- Retry is available for tab data fetch failures.

### Mobile behavior

- Banner height reduces to 120px on 320px screens.
- Avatar overlaps banner and stats row; stats row becomes horizontally scrollable.
- Tab bar becomes a horizontal scroll pill row.

### Data dependencies

- `getProfileByHandle(handle)`
- `getFeaturedMix(userId)` — pinned or latest mix
- `getUserMixes(userId)`, `getUserSets(userId)`, `getUserPlaylists(userId)`, `getUserReleases(userId)`, `getUserCollabs(userId)`, `getProfileStats(userId)`, `getUserAgents(userId)`
- `getUserActivity(userId)` for Activity tab

## Success metrics

- Profile loads in < 1.5s for cached profiles.
- Tab switches feel instant (< 300ms perceived).
- No layout shift after banner image loads.
