# 40 — Hive Composer UX and Flows

**Phase 10 · Product + UX Spec**

> Extends: doc 22 (co-production sessions — multi-user real-time collab), doc 27 (Realtime architecture)
> Depends on: doc 39 (`find_set_continuations` RPC, `mh.find_set_continuations`)
> This doc covers **solo set building with AI vector suggestions** — not multi-user collab.

---

## 1. Concept

The Hive Composer is a personal set and playlist builder where:

- Each track or mix is a **hexagonal "cell"** in an expandable honeycomb canvas
- The honeycomb **grows organically** — adding a cell causes the composer to query for 3
  vector-similar continuations and display them as adjacent suggestion cells
- Suggestions come from `find_set_continuations` (doc 39): cosine similarity + BPM constraints
- The final set exports to the existing `playlists` + `playlist_mixes` schema (migration 005)
- Route: `/composer` — accessible from the left nav under a "Create" section

**What the Hive Composer is NOT:**
- Not an audio editor or DAW
- Not a multi-user real-time room (that is the Collab Session at `/session/:id`, docs 22/27)
- Not a discovery feed or recommendation carousel (that is the existing feed + agent inbox)

---

## 2. Cell Types

The canvas uses 4 distinct hex cell types, each with a distinct visual treatment (see doc 41
for `HexCell` component spec):

| Cell type | Appearance | Semantics |
|---|---|---|
| **Track cell** | Filled surface, solid border | Confirmed track in the set |
| **Suggestion cell** | Transparent, gold dashed border | Vector suggestion; tap to accept |
| **Gap cell** | Transparent, grey dashed border | BPM mismatch hint between two cells |
| **Add cell** | Transparent, grey `+` icon | Last cell; opens mix search picker |

### Track cell inner layout

- Line 1: Mix title (truncated, 14px semi-bold)
- Line 2: Artist name (12px dim text)
- Bottom row: `BpmChip` (e.g. "132 BPM") + duration chip ("1h 12m")
- Left edge: 3px `getGenreColor(genre)` accent strip (from doc 41)
- When playing: `WaveformAccent` animates inside the cell

### Suggestion cell inner layout

- Same as Track cell
- Top-right badge: similarity score "↑ 94% vibe" (cosine similarity formatted as %)
- Bottom row adds: key compatibility chip ("✓ 8A→9A compatible") from Camelot notation
- Hover: cell border transitions from dashed to solid gold

---

## 3. Canvas Mechanics

### 3.1 Hex grid layout

The canvas is a CSS-only hex grid (no WebGL, no canvas element). See doc 41 §5 for the
detailed CSS honeycomb layout pattern using `clip-path` and offset rows.

Desktop (≥1024px): 5-column hex grid, 120px cells, 8px gap
Tablet (768–1023px): 3-column, same cell size
Mobile (≤767px): Linear vertical scroll — hex clip-path removed; each cell is a full-width row
with a 4px hex-shaped left border accent and right-aligned BPM chip

### 3.2 Expanding logic

```
1. User adds a track (via search picker or "Add cell" tap)
2. Track cell renders in the canvas (animated expand, 150ms pageIn)
3. Composer calls POST /api/composer/suggest with { mix_id: lastCellId, bpm_range: ±5 }
4. API returns 3 suggestions (similarity, title, bpm, key_camelot)
5. 3 suggestion cells appear adjacent to the new track cell (staggered 50ms each)
6. Old suggestion cells (from the previous last cell) are greyed out but remain visible
```

On drag-to-reorder:
- User drags a track cell to a new position
- Set sequence re-derives (positions update)
- Suggestions query re-fires for the new last cell
- Old suggestions are replaced

### 3.3 Dismissing suggestions

- Tap the `×` on a suggestion cell → `vector_suggestion_dismissed` event fires
  with `{suggestion_mix_id, rank, reason: 'dismissed'}`
- That mix_id is excluded from future suggestion queries in this session (stored in component state)
- If all 3 suggestions are dismissed, a "Show more" button appears triggering a fresh query with k=6

### 3.4 Accepting a suggestion

- Tap a suggestion cell → it transitions (150ms) from suggestion→track visual
- Track cell is added to the sequence
- `vector_suggestion_added_to_set` event fires
- 3 new suggestions generate from the newly accepted track

### 3.5 Export

- "Save set" button at the top of the composer
- Creates a `playlists` row (`owner_id`, `title`, `description`)
- Creates `playlist_mixes` junction rows in sequence order (using existing `position` column)
- Returns user to `/profile/{id}` Playlists tab with a toast "Set saved as playlist"

---

## 4. Suggestion UX Details

### 4.1 Similarity badge

Label: "↑ {similarity_pct}% vibe match" where `similarity_pct = Math.round(similarity * 100)`
Color: gold if ≥80%, muted if 60–79%, dimmed if < 60%
Position: top-right of the suggestion cell

### 4.2 BPM transition note

Derived from the last confirmed track's BPM and the suggestion's BPM:

```
±0 BPM → "Same tempo" (green)
±1–5 BPM → "Easy transition" (gold)
±6–15 BPM → "Gradual build" (amber)
>15 BPM → shown as gap cell instead (BPM mismatch)
```

### 4.3 Key compatibility

Camelot Wheel check: compatible keys are same number (±0) or same letter with ±1 number.
Label: "✓ Compatible key" (green) or "△ Harmonically different" (amber, still allowed)
Source: `key_camelot` column from `audio_features` table

### 4.4 Scene tag

If the suggestion has the same scene tag as the current set's most common genre:
`"Also {genre} / {city}"` rendered as a small tag below the similarity badge.
Derived from the mix's `tags[]` metadata in `ai_embeddings.metadata`.

---

## 5. User Flows

### Flow 1: New set from scratch

```
Nav → "Composer" (left nav, Create section)
  → Empty canvas with single "Add cell" hex in the centre
  → Tap "+ Start a new set" or search modal auto-opens
  → User types artist or mix title in the search modal
  → First track cell appears (animated)
  → 3 suggestion cells appear adjacent
  → User accepts 1, dismisses 2
  → New track + 3 new suggestions appear
  → Repeat until satisfied (10–20 tracks typical set)
  → "Save as playlist" → saved to /profile Playlists tab
```

### Flow 2: Extend an existing playlist

```
Profile → Playlists tab → playlist card → "Open in Composer" button
  → Composer loads with existing tracks as confirmed cells (in sequence order)
  → Suggestion cells appear after the last existing track
  → User continues building from where they left off
  → Save overwrites existing playlist (confirmation dialog if >0 changes)
```

### Flow 3: Scene crate dig

```
Composer → "Browse by scene" button (top-right of canvas)
  → Slide-over panel shows scene clusters (derived from profile's genre_tags[])
  → User selects a scene (e.g. "Berlin Techno")
  → Seed cell is the highest-similarity mix in that scene's embedding neighborhood
  → All subsequent suggestions are filtered to that scene's vector neighborhood
  → Scene filter badge shows in canvas header: "🐝 Berlin Techno mode"
  → User can clear the filter to return to unrestricted suggestions
```

---

## 6. Agent Panel Integration

The right 340px contextual panel (doc 29 §2 layout) surfaces the **Set Composer Agent** during
composition. The agent does NOT run automatically — it runs on user click.

### 6.1 Trigger

Button: "Analyse my set" (in the right panel, disabled until ≥3 tracks in the set)

### 6.2 What the agent does

1. Reads all confirmed track cells (up to 20 mix IDs)
2. Fetches embeddings for each via `mh.find_similar_mixes` to derive the set's energy arc
3. Uses `mh.llm.call` or LLM tool to generate 1–2 observations:
   - Energy: "Your set builds from 128→138 BPM over 8 tracks — strong momentum arc"
   - Vibe consistency: "Tracks 1–5 are cohesive acid-techno; track 6 shifts to industrial, which may feel abrupt"
   - Optional suggestion: "Consider a breakdown track around position 6 — try {suggested_mix_title}"
4. Returns result as a contextual card in the right panel (gold left-border `MythicPulseCard` style from doc 29)

### 6.3 Agent script

The `set_composer_agent.lua` Lua script (doc 43 handoff) handles this flow using
`mh.find_set_continuations` for energy analysis and `mh.llm.json` for the narrative output.

---

## 7. MythicNode Integration

When a set is saved:
- If the set contains tracks from **≥2 different artists**: a `collab_with` edge is proposed
  (not auto-created — requires user confirmation via the existing MythicNode suggestion card)
- The saved playlist is linked to the profile node via a new `session_produced_mix` edge
  (reusing the edge type from doc 27 §4) between the profile's `artist_profile` node and the
  first mix node in the set
- This surfaces in the Hive Story (doc 42) as a potential "Set composed" chapter

---

## 8. State Management and Persistence

The Hive Composer is a client-side React component with no server-side state during composition.

- Set in progress is stored in component state (`useReducer`) — not persisted until "Save"
- If user navigates away: confirm dialog "You have an unsaved set. Discard?"
- Browser refresh: set lost (no autosave in Phase 10 — autosave is a Phase 11+ concern)
- `localStorage` backup: optional enhancement; if enabled, key = `composer_draft_{user_id}`

---

## 9. Accessibility

- All `HexCell` components are `<button>` elements with `aria-label="{title} by {artist}, BPM {bpm}"`
- Canvas container: `role="grid"` with `aria-label="Set composer"`
- Keyboard navigation: arrow keys move focus between cells, Enter to accept/confirm, Esc to dismiss
- Track cells: `role="gridcell"` with `aria-selected={true}`
- Suggestion cells: `role="option"` with `aria-label="Suggestion: {title} — {similarity}% vibe match"`
- Screen reader announcement on suggestion acceptance: live region `aria-live="polite"`

---

## Codex Handoff

- **`/api/composer/suggest`** — POST endpoint:
  - Auth required
  - Body: `{ mix_id: string, bpm_min?: number, bpm_max?: number, k?: number }`
  - Calls `find_mixes_for_set_context` RPC with the mix's stored embedding
  - Returns: `{ suggestions: [{ mix_id, title, artist, similarity, bpm, key_camelot, genre }] }`
  - Rate limit: 60 req/min per user

## Claude Code Handoff

- **`src/views/HiveComposer.tsx`** — main view at route `/composer`
- **`src/components/HexCell.tsx`** — interactive hex cell (doc 41 §1 spec)
- **`src/components/composer/ComposerCanvas.tsx`** — hex grid layout + expansion logic
- **`src/components/composer/ComposerAgentPanel.tsx`** — right 340px panel with "Analyse my set"
- **`src/components/composer/SuggestionCell.tsx`** — suggestion cell with similarity badge + key chip
- Wire `/composer` into `src/App.tsx` React Router route tree and left nav (under "Create" section)
