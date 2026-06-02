# 46 — Hive Composer v2

**Phase 12 · UX Spec**

> Extends: doc 40 (Phase 10 Hive Composer UX), doc 45 (vector layer v2)
> References: `src/views/HiveComposer.tsx`, `src/components/composer/ComposerCanvas.tsx`, `src/app/api/composer/suggest/route.ts`

---

## 1. What Phase 10 Shipped

- Hex cell flex-row canvas with `clip-path` polygon cells
- Add/remove tracks via search modal
- Vector suggestions from `/api/composer/suggest`
- Drag-to-reorder (Phase 11)
- localStorage autosave (Phase 11)
- `vector_suggestion_shown` + `vector_suggestion_added_to_set` analytics events

## 2. Phase 12 Additions

### 2.1 Scene Filter Mode

After the user adds at least 1 track, a filter chip row appears between the top bar and the canvas. Chips derive from the last track in the set:

```
[ Genre: Techno ×]   [ 128–138 BPM ×]
```

**Filter state** (added to `HiveComposer` component, not the reducer — UI-only state):
```typescript
const [genreFilter, setGenreFilter] = useState<string | null>(null);
const [bpmRange, setBpmRange] = useState<[number, number] | null>(null);
```

After `ADD_TRACK`, derive defaults from the new tail track:
```typescript
useEffect(() => {
  const tail = state.tracks[state.tracks.length - 1];
  if (!tail) return;
  if (tail.genre) setGenreFilter(tail.genre);
  if (tail.bpm) setBpmRange([Math.max(0, tail.bpm - 10), tail.bpm + 10]);
}, [state.tracks.length]);
```

When `fetchSuggestions` runs, pass filter values to the API:
```typescript
const body = {
  mix_id: mixId,
  k: 3,
  ...(bpmRange ? { bpm_min: bpmRange[0], bpm_max: bpmRange[1] } : {}),
  ...(genreFilter ? { genre_hint: genreFilter } : {}),
};
```

Dismissing a chip clears that filter and re-fetches suggestions.

### 2.2 Filter Chip UI

```jsx
{state.tracks.length > 0 && (genreFilter || bpmRange) && (
  <div style={{ display: 'flex', gap: 6, padding: '6px 24px', flexShrink: 0 }}>
    {genreFilter && (
      <button className="filter-chip" onClick={() => { setGenreFilter(null); fetchSuggestions(...); }}>
        Genre: {genreFilter} ×
      </button>
    )}
    {bpmRange && (
      <button className="filter-chip" onClick={() => { setBpmRange(null); fetchSuggestions(...); }}>
        {bpmRange[0]}–{bpmRange[1]} BPM ×
      </button>
    )}
  </div>
)}
```

CSS in `mixhive.css`:
```css
.filter-chip {
  padding: 3px 10px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 999px;
  color: var(--accent);
  font-size: 11px;
  cursor: pointer;
}
```

### 2.3 `vector_suggestion_dismissed` Analytics Event

Currently missing. Add to `handleDismissSuggestion` in `HiveComposer.tsx`:
```typescript
const handleDismissSuggestion = useCallback((mix_id: string) => {
  dispatch({ type: 'DISMISS_SUGGESTION', mix_id });
  if (user) {
    supabase.from('experiment_events').insert({
      profile_id: user.id,
      event_type: 'vector_suggestion_dismissed',
      feature: 'hive_composer',
      variant: 'v1',
      properties: { mix_id },
    }).then(() => {});
  }
}, [user]);
```

---

## 3. True CSS Hex Grid (Future Enhancement)

The Phase 10 canvas is a flex row — correct for a linear set sequence. A true honeycomb grid would be appropriate for a "Scene Crate Dig" mode (browsing a catalog by scene). This is specified for a future Claude Code pass:

```css
.hex-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 24px;
}

/* Even rows offset by half cell width for honeycomb */
.hex-grid > *:nth-child(odd of .hex-row) {
  margin-left: calc(120px / 2 + 2px);
}
```

Breakpoints:
- ≥1024px: 5 columns (120px cells)
- 768–1023px: 3 columns
- ≤767px: linear scroll, hex shape only as left accent stripe

---

## 4. Scene Crate Dig Flow

1. User taps "Crate dig by scene" button in the composer header
2. Genre picker modal opens — lists `genreColors` keys as colored pills
3. User selects a genre → frontend calls `find_scene_neighbors` RPC to find the scene embedding, then hits `/api/composer/suggest` with that scene's centroid embedding
4. Results fill a hex grid (not linear row) in a second panel
5. User clicks any cell to add to the current set

This flow is specified but deferred to a future phase; the architecture in doc 45 §2 makes it possible without schema changes.

---

## 5. Mobile Layout

At ≤767px:
- Composer canvas scrolls vertically in a single column
- Hex cells rendered at `sm` size (64×74px) with genre accent stripe as main visual
- Filter chips hidden; BPM/genre shown as text below each cell
- Agent panel accessible via a bottom sheet triggered by ⚡ button

---

## 6. Codex Handoff

- `POST /api/composer/suggest`: accept `genre_hint` param and pass to `find_mixes_for_set_context` RPC (migration 076 updates the RPC signature)
- No new migrations needed for the filter chips — pure frontend state

## 7. Claude Code Handoff

- `HiveComposer.tsx`: filter state + chip row + dismissed event (Phase 12 Step 2)
- `api/composer/suggest/route.ts`: accept `genre_hint` (Phase 12 Step 2)
