# Upload Release Flow v1 — Acceptance Criteria

**Date:** 2026-06-30 · **Status:** Spec ready for implementation

## Context

The `/upload` route is the primary creator flow for adding a mix to MixHive. It is currently implemented as a 5-step wizard: **Audio → Metadata → Artwork → Tracklist → Publish**. This spec turns the existing implementation into a stable, testable contract and establishes the foundation for the release mechanics defined in the companion addendum (`2026-06-30-release-mechanics-v1-addendum.md`).

## Scope

### In scope

- 5-step upload wizard with stepper navigation.
- Audio file selection, duration detection, and upload with progress.
- Metadata form: title, description, genre, tags, explicit flag.
- Artwork upload with preview.
- Tracklist editor with timestamp + artist + title rows.
- Final publish step with validation and post-publish success panel.
- Save-as-draft behavior during the wizard (local auto-save + explicit save).
- Cancel / abort upload at any step.
- Mobile-first responsive layout.

### Out of scope

- Scheduled publishing (see Release Mechanics Addendum).
- Platform link editing beyond the existing fields (see Release Mechanics Addendum).
- Post-publish agent triggers beyond the static suggestions already shown (see Release Mechanics Addendum).
- Real audio waveform generation failures are handled gracefully but waveform editing is out of scope.

## Acceptance criteria

### First screen

- Authenticated users navigating to `/upload` see the stepper with **Audio** active and the drop zone ready.
- Unauthenticated users are redirected to `/login` with `?returnTo=/upload`.
- The page title is localized as "Nectar Upload".

### Step 1 — Audio

- Users can drag-and-drop an audio file or click the drop zone to browse.
- Accepted formats: MP3, WAV, AAC, OGG (matching `UploadSchema`).
- Max file size: 100 MB.
- On valid drop/selection, the file is held in state and duration detection begins.
- Duration detection completes within 15 s or shows an inline error and clears the file.
- A valid audio file unlocks the **Next** button.
- Users can remove the selected audio file and return to the empty drop zone.

### Step 2 — Metadata

- Required field: **Title** (1–100 chars).
- Required field: **Genre** (single select from `genres` table).
- Optional: **Description** (≤ 10 000 chars).
- Optional: **Tags** (≤ 10 tags, comma or Enter separated, displayed as chips).
- Optional: **Explicit content** toggle.
- Inline validation errors appear on blur/submit, not on first render.
- All required fields valid → **Next** enabled.

### Step 3 — Artwork

- Users can drop or browse an image file.
- Accepted formats: JPG, PNG, WebP.
- Max file size: 10 MB.
- A square crop/preview is shown after selection.
- Users can remove or replace the artwork.
- Artwork is optional at this stage; a default artwork placeholder is used on publish if none is provided.

### Step 4 — Tracklist

- Users can add rows with **Artist**, **Title**, and optional **Start time**.
- Start time defaults to `0:00` for the first row and the previous row's start + estimated duration for subsequent rows.
- Users can reorder rows via drag handles or up/down buttons.
- Users can delete rows.
- Empty tracklist is allowed; the mix publishes without a tracklist.
- Validation: artist/title pairs cannot be blank if a row is added.

### Step 5 — Publish

- A summary card shows: title, genre, duration, artwork preview, tag chips, tracklist count.
- Primary action: **Publish now** → calls `createMix`, uploads files, then navigates to the mix page on success.
- Secondary action: **Save draft** → persists a draft mix (`published: false`) and shows a confirmation toast.
- Tertiary action: **Back** returns to the tracklist step.
- Publishing shows a blocking upload progress overlay with percentage, bytes loaded/total, and current label.
- Users can cancel the upload; cancellation aborts the in-flight XHR and returns to the publish step with a recoverable error.

### Primary action

- The persistent **Upload mix** CTA in the global nav navigates to `/upload`.
- On `/upload`, the primary action advances through steps or triggers publish on the final step.

### Empty state

- The audio drop zone has an empty state: icon + "Drop your mix" + supported formats hint.
- The tracklist editor shows a "No tracks added yet" placeholder with an **Add track** CTA.

### Loading state

- Audio duration detection shows a spinner with "Detecting duration…".
- File upload shows `UploadProgress` with animated bar and label ("Uploading audio…", "Uploading artwork…").
- Publish step shows a full-viewport overlay while the mix is being created.

### Error state

- File type/size errors appear inline in the relevant step.
- Network errors during upload show a retry-able inline banner with **Retry** and **Cancel**.
- `createMix` failure shows a non-blocking top banner with the error message and a **Try again** button.
- Validation errors block step advancement and highlight offending fields.

### Mobile behavior

- At 320px, the stepper becomes horizontally scrollable with compact step labels (numbers visible, text truncated if needed).
- Drop zones remain tappable with a minimum 44×44 hit area for the browse button.
- Tracklist rows stack fields vertically.
- Publish summary stacks vertically with full-width action buttons.

### Data dependencies

- `genres` table (id, name) for the genre select.
- `createMix`, `updateMix` from `src/lib/api`.
- Supabase Storage buckets: `AUDIO_BUCKET`, `ARTWORK_BUCKET`, `WAVEFORM_BUCKET`.
- `UploadSchema` from `src/lib/schemas` for form validation.

### Draft auto-save

- While the user moves between steps, form state is auto-saved to `localStorage` under `mixhive-upload-draft`.
- On returning to `/upload`, the user is prompted to resume the draft or start fresh.
- Successful publish clears the draft key.
- Explicit **Save draft** also clears the localStorage draft after server persistence.

## Success metrics

- Upload completes end-to-end in < 3 s per 10 MB on a 4G connection (excluding audio processing).
- No layout shift after artwork preview loads.
- All 5 steps are reachable and submittable with keyboard-only navigation.
- No console errors during a successful upload.
