# Release Mechanics v1 — Addendum

**Date:** 2026-06-30 · **Status:** Spec ready for implementation

## Context

This addendum extends the **Upload Release Flow v1** spec with the first release-control features: drafts, scheduled publishing, platform links, and post-publish agent suggestions. It is intentionally separate so the core upload wizard can be stabilized while release mechanics are implemented in parallel.

## Scope

### In scope

- Explicit **Save draft** and draft resume from `/upload`.
- **Schedule for later** with a simple datetime picker on the publish step.
- **Platform links** section for external URLs (SoundCloud, Mixcloud, YouTube, Spotify, Apple Music).
- Post-publish agent suggestions (Release Strategy, Press Kit) in the success panel.
- Draft → scheduled → published state machine.
- A creator's **Drafts** surface on `/dashboard` or `/u/:handle` (minimum: list on dashboard).

### Out of scope

- Real platform integrations / API posting.
- Recurring scheduled releases.
- Release campaigns with multiple mixes.
- Embargo or geo-restricted publishing.

## Schema changes

The following columns are added to the `mixes` table via a new migration (do not edit existing migrations):

| Column | Type | Default | Notes |
|---|---|---|---|
| `visibility` | `text not null` | `'draft'` | CHECK `('draft','scheduled','published','unlisted')` |
| `scheduled_at` | `timestamptz` | `null` | Set when `visibility='scheduled'` |
| `published_at` | `timestamptz` | `null` | Set when `visibility` becomes `'published'` |

The existing `published` boolean is deprecated and computed as `visibility = 'published'` for backwards compatibility.

RLS: only the owning `dj_id` can read drafts/scheduled mixes; published/unlisted mixes follow existing rules.

## Acceptance criteria

### Draft state

- On the publish step, **Save draft** persists the mix with `visibility='draft'` regardless of required field completeness.
- Drafts are listed in a "Drafts" section on `/dashboard`.
- Clicking a draft opens `/upload?draft=<mixId>` with all saved data restored.
- Drafts do not appear in public feeds, discover, or profile mixes tabs.
- Drafts can be deleted from the dashboard with a confirmation dialog.

### Schedule for later

- On the publish step, a toggle lets the user choose **Publish now** or **Schedule for later**.
- When scheduled, a datetime picker enforces a future time (minimum now + 5 minutes).
- On submit, the mix is saved with `visibility='scheduled'` and `scheduled_at=<chosen time>`.
- Scheduled mixes appear in the dashboard "Scheduled" section with a countdown.
- A cron or edge function publishes scheduled mixes when `scheduled_at <= now()` by flipping `visibility='published'` and setting `published_at`.
- Scheduling requires all publish-step validation to pass (title, genre, audio URL).

### Platform links

- A **Platform links** section is available on the metadata step and editable post-publish.
- Supported platforms: SoundCloud, Mixcloud, YouTube, Spotify, Apple Music.
- Each field validates as a URL or remains empty.
- Platform links are stored as JSON in the existing `platform_links` column.
- On the mix detail page, valid platform links render as branded outbound buttons.

### Post-publish agent suggestions

- After successful publish, `PostPublishPanel` shows agent cards for **Release Strategy** and **Press Kit**.
- Tapping a card navigates to `/agents/gallery?category=release` with the relevant agent highlighted.
- Each card shows a one-line value prop (e.g., "Plan your release week" / "Generate a press kit").

### Unlisted option (optional v1.1, out of v1)

- `visibility='unlisted'` is reserved for a follow-up; the schema includes it for forward compatibility but the UI does not expose it in v1.

### State machine

```
draft ──[publish now]──► published
  │
  └──[schedule]────────► scheduled ──[cron fires]──► published
```

- Transitions are service-role or owner-only.
- `published_at` is set exactly once on the first publish transition.
- Reverting from `published` to `draft` is not allowed in v1.

### Mobile behavior

- The schedule datetime picker uses the native mobile datetime input.
- Platform link fields stack vertically on 320px screens.
- Draft and scheduled sections on the dashboard are collapsed into accordions on small screens.

### Error state

- Scheduling a date in the past shows an inline error: "Choose a future date and time."
- Missing required fields when scheduling block submission and highlight the relevant step(s).
- Cron failures are logged and retried; missed scheduled publishes trigger a notification to the creator.

## Data dependencies

- `mixes` table with new `visibility`, `scheduled_at`, `published_at` columns.
- New or updated API routes:
  - `POST /api/mixes/draft` — create or update draft.
  - `POST /api/mixes/schedule` — create or transition to scheduled.
  - `POST /api/cron/publish-scheduled` — cron-gated batch publish.
- Existing `createMix`, `updateMix`, and `PostPublishPanel`.

## Success metrics

- Users can save a draft and resume it without data loss.
- Scheduled mixes publish within 1 minute of the chosen time.
- Platform links are clickable on the mix detail page.
- Post-publish agent cards have a > 10% click-through rate in the first week.
