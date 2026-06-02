# Phase 11 — Vector Discovery Surface, Composer Autosave, and Drag-to-Reorder

## Context

Phase 10 shipped the full vector intelligence pipeline: HNSW index, 6 similarity RPCs, embedAndStoreEntity, embed-refresh cron, and the Hive Composer. The RPCs (`find_similar_mixes`, `find_similar_artists`, `find_mixes_for_set_context`) are live in production but not surfaced in any UI. Phase 11 closes that gap and completes deferred Hive Composer UX items.

## What Phase 11 Adds

### 1. Similar Mixes Panel (MixDetail)
`src/components/SimilarMixesPanel.tsx` — new component.
- Calls `find_similar_mixes(p_mix_id, p_k=4)` via `supabase.rpc`.
- Renders up to 4 inline cards: title, artist, genre, BPM chip, similarity badge (e.g. "↑ 87% vibe match").
- Loading: 3 SkeletonBar placeholders. Empty: renders null.
- Injected into `MixDetail.tsx` after the "Fans Also Liked" block.

### 2. Similar Artists Panel (Profile)
`src/components/SimilarArtistsPanel.tsx` — new component.
- Calls `find_similar_artists(p_profile_id, p_k=3)` via `supabase.rpc`.
- Renders 3 DJ cards: username, genre tags, similarity %. Links to `/u/:username`.
- Injected into `Profile.tsx` after genres/stats section, before tabs.

### 3. HiveComposer Autosave
- Draft key: `mh_composer_${user.id}` in localStorage.
- Auto-saves `{ tracks, setTitle }` on every track/title change.
- On mount: if draft found and current state is empty, restores silently + shows a dismissable gold banner.
- Clears draft on successful playlist save.

### 4. HiveComposer Drag-to-Reorder
- HTML5 drag API on each track HexCell in `ComposerCanvas.tsx`.
- `REORDER_TRACKS` action in the reducer: splices track array from→to index.
- Visual: dragging cell gets `opacity: 0.5`; drop target gets a gold left border highlight.
- After reorder: re-fetches suggestions for the new tail track.

## Files Changed

| File | Change |
|------|--------|
| `src/components/SimilarMixesPanel.tsx` | New |
| `src/components/SimilarArtistsPanel.tsx` | New |
| `src/views/MixDetail.tsx` | Add SimilarMixesPanel |
| `src/views/Profile.tsx` | Add SimilarArtistsPanel |
| `src/views/HiveComposer.tsx` | Autosave + REORDER_TRACKS dispatch |
| `src/components/composer/ComposerCanvas.tsx` | Drag events + onReorder prop |

## Verification

```bash
npx tsc --noEmit
npm run build
# Manual: open /mix/:id with embedded content → "Similar Vibes" section visible
# Manual: open /u/:username → "Similar DJs" section visible
# Manual: open /composer → add 2 tracks, close tab, reopen → draft restored
# Manual: drag a track in composer → order updates, new suggestions fired
```

Resolves: Phase 11
