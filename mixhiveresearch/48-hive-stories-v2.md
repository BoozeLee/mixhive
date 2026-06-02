# 48 — Hive Stories v2

**Phase 12 · UX Spec**

> Extends: doc 42 (Phase 10 Hive Stories and Journey Views)
> References: `src/views/HiveStory.tsx`, `src/components/story/SoundEvolutionBanner.tsx`, `src/app/api/cron/embed-refresh/route.ts`

---

## 1. What Phase 10 Shipped

- `HiveStory` view with chapter chain from `get_profile_story` RPC
- `SoundEvolutionBanner` component that reads `profile_snapshot` rows from `ai_embeddings`
- `StoryDetailPanel` — right panel on chapter select
- Evolution `narrative` string shown in a gold left-border card
- "Check back soon" fallback when no narrative is available

## 2. Gaps in Phase 10 / Phase 11

1. **Single narrative string** — Phase 10 renders `evolution.narrative` as one block of text. There is no structured breakdown of *early genres* → *recent genres*.
2. **No evolution score** — the `evolutionScore` field is part of `EvolutionData` but never rendered as a visual indicator.
3. **Snapshot data not surfaced in detail** — the 3 `profile_snapshot` rows exist in `ai_embeddings.metadata` with `snapshot_index`, but the UI ignores the `period_start`/`period_end` metadata fields.
4. **StoryDetailPanel is static** — it shows chapter text but no related mixes panel.

---

## 3. Phase 12: 3-Period Genre Timeline

### 3.1 Data Source

The embed-refresh cron already populates `ai_embeddings` rows with `entity_type = 'profile_snapshot'` for each profile that has ≥6 mixes. The `metadata` JSONB column contains:

```json
{
  "snapshot_index": 0,
  "period_start": "2024-01-01",
  "period_end": "2024-04-30",
  "genre_tags": ["techno", "industrial"],
  "narrative": "..."
}
```

`genre_tags` is a computed field — the most common genres among mixes in this period (derived from `mixes.genre` for mixes uploaded in the time window).

**Schema note:** `genre_tags` in `metadata` is populated by `/api/cron/embed-refresh`. The cron currently only stores `narrative` — Phase 12 adds `genre_tags` computation.

### 3.2 Extended Cron Logic (`/api/cron/embed-refresh`)

In the profile snapshot section:

```typescript
// For each snapshot period, compute top 3 genres
const genreCounts = new Map<string, number>();
for (const mix of periodMixes) {
  if (mix.genre) {
    genreCounts.set(mix.genre, (genreCounts.get(mix.genre) ?? 0) + 1);
  }
}
const topGenres = [...genreCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([g]) => g);

metadata = {
  snapshot_index: i,
  period_start: periodStart.toISOString(),
  period_end: periodEnd.toISOString(),
  genre_tags: topGenres,
  narrative: narrativeText,
};
```

### 3.3 UI: 3-Period Timeline

In `HiveStory.tsx`, the evolution section is replaced with:

```
[Early: Techno · Industrial]  →  [Mid: DnB · Garage]  →  [Recent: House · Minimal]
```

Implementation:

```typescript
interface SnapshotPeriod {
  index: number;
  genreTags: string[];
  periodLabel: string; // 'Early', 'Mid', 'Recent'
}

// Parse snapshots from ai_embeddings rows
const periods: SnapshotPeriod[] = rows.map((r, i) => ({
  index: r.metadata.snapshot_index,
  genreTags: r.metadata.genre_tags ?? [],
  periodLabel: i === 0 ? 'Early' : i === 1 ? 'Mid' : 'Recent',
}));
```

Rendered as a flex row with `→` connector arrows between periods. Each period shows:
- Period label (uppercase small, `colors.text.muted`)
- Genre tag pills using `getGenreColor()` for background tint

### 3.4 Evolution Score Bar

If `evolutionScore` is available (0.0–1.0, computed as cosine similarity between snapshot 0 and snapshot 2):

```typescript
const label =
  evolutionScore >= 0.7 ? 'Consistent'
  : evolutionScore >= 0.4 ? 'Evolving'
  : 'Transformed';
```

Rendered as a horizontal progress bar:
- Width: `evolutionScore * 100%`
- Color: `peak` (acid green) for Transformed; `ambient` (blue) for Consistent; `groove` (gold) for Evolving
- Label displayed to the right of the bar

---

## 4. `EvolutionData` Type Extension

Current type in `SoundEvolutionBanner.tsx`:
```typescript
export interface EvolutionData {
  narrative?: string | null;
  evolutionScore?: number | null;
}
```

Phase 12 extends:
```typescript
export interface EvolutionData {
  narrative?: string | null;
  evolutionScore?: number | null;
  periods?: Array<{
    index: number;
    genreTags: string[];
    periodLabel: string;
  }> | null;
}
```

---

## 5. `StoryDetailPanel` Enhancement

When the user selects a chapter, the right panel currently shows the chapter type, label, and date.

Phase 12 addition: for `chapter_type === 'set'` (session_produced_mix edges), show a "Related mixes" section — calls `find_similar_mixes` with the mix_id from `props.mix_id` and renders up to 3 results as compact list items.

This is specified here but deferred to a future pass. The chapter detail panel is already functional; the related-mixes addition requires reading `chapter.props.mix_id` which may not always be populated.

---

## 6. Privacy Model

Unchanged from Phase 10 (doc 42 §5):
- `show_journey` boolean on profiles controls Story tab visibility
- Public stories visible to any visitor
- Profile snapshots keyed to profile_id — no cross-user access

---

## 7. Codex Handoff

- `/api/cron/embed-refresh`: add `genre_tags` array to profile_snapshot `metadata` when computing snapshot text

## 8. Claude Code Handoff

- `src/views/HiveStory.tsx`: 3-period genre timeline + evolution score bar (Phase 12 Step 2)
- `src/components/story/SoundEvolutionBanner.tsx`: accept extended `EvolutionData` with `periods`
