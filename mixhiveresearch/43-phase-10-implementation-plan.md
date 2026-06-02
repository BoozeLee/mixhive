# 43 — Phase 10 Implementation Plan

**Phase 10 · Codex + Claude Code Roadmap**

> Covers: docs 39–42 implementation breakdown, migration numbers, file paths, success criteria,
> and verification commands.

---

## 1. Codex Tasks (Schema, Infra, Backend)

### Migration 074 — HNSW vector index

**File:** `supabase/migrations/074_ai_embeddings_hnsw_index.sql`

```sql
-- Migration 074: HNSW index on ai_embeddings.embedding for fast cosine search
--
-- Requires pgvector ≥ 0.5.0 (Supabase supports HNSW since mid-2024).
-- CONCURRENTLY means no table lock on the live DB.
-- m=16, ef_construction=64 is balanced for 100K+ vectors.
-- Set hnsw.ef_search=40 at query time for < 100ms p99.
--
-- Resolves: Phase 10 doc 39 §6.1

begin;

create index concurrently if not exists idx_ai_embeddings_hnsw
  on public.ai_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Partial indexes per entity_type improve query planning when filtering by type
create index concurrently if not exists idx_ai_embeddings_hnsw_mix
  on public.ai_embeddings (entity_id)
  where entity_type = 'mix';

create index concurrently if not exists idx_ai_embeddings_hnsw_profile
  on public.ai_embeddings (entity_id)
  where entity_type = 'profile';

commit;
```

### Migration 075 — Similarity RPCs + story RPC + profile columns

**File:** `supabase/migrations/075_vector_similarity_rpcs.sql`

New security-definer RPCs (doc 39 §3):
- `find_similar_mixes(p_mix_id uuid, p_k int) → table`
- `find_similar_artists(p_profile_id uuid, p_k int) → table`
- `find_scene_neighbors(p_scene_cluster_id uuid, p_k int) → table`
- `find_mixes_for_set_context(p_embedding vector(1536), p_bpm_min int, p_bpm_max int, p_k int) → table`
- `find_collab_candidates_hybrid(p_profile_id uuid, p_k int) → table` (graph+vector hybrid, doc 39 §4.1)

New story RPC (doc 42 §2.3):
- `get_profile_story(p_profile_id uuid) → table`

New profile column (doc 42 §5):
- `alter table public.profiles add column if not exists show_journey boolean not null default false;`

All RPCs: `revoke execute from public; grant to authenticated, service_role`.

### New cron: `/api/cron/embed-refresh`

**File:** `src/app/api/cron/embed-refresh/route.ts`

Add to `vercel.json` crons:
```json
{ "path": "/api/cron/embed-refresh", "schedule": "0 3 * * *" }
```

Algorithm (doc 39 §2.2):
1. Query `ai_embeddings` rows with `updated_at < now() - interval '7 days'` for entity_type in
   ('mix', 'profile'), limit 200
2. For each row, fetch source text from the appropriate table, re-embed, upsert
3. After profile refreshes: compute 3-snapshot centroids for profiles with ≥3 published mixes
4. Store snapshots as `entity_type='profile_snapshot'` with `metadata.snapshot_index`
5. If snapshot 1 and 3 both exist: call LLM for narrative annotation, store in snapshot-3's metadata

### New API route: `/api/composer/suggest`

**File:** `src/app/api/composer/suggest/route.ts`

- POST, auth required
- Body: `{ mix_id: string, bpm_min?: number, bpm_max?: number, k?: number }`
- Fetches embedding for `mix_id` from `ai_embeddings`
- Calls `find_mixes_for_set_context` with that embedding + BPM range
- Returns: `{ suggestions: [{ mix_id, title, artist, similarity, bpm, key_camelot, genre }] }`
- Rate limit: 60 req/min per user
- Cache: Redis `similar:mix:{mix_id}:k{k}` TTL 1h

### New utility: `src/lib/embed-entity.ts`

Shared helper for fire-and-forget embedding on upload/save (doc 39 §2.1). Called from:
- `src/app/api/upload/route.ts` (after mix insert)
- `src/app/api/profiles/[id]/route.ts` (after profile update)

---

## 2. Claude Code Tasks (Frontend / UX)

### 2.1 Token and CSS updates

**`src/styles/tokens.ts`** — add:
- `genreColors` record (22+ genre → HSL string mappings, doc 41 §2.1)
- `getGenreColor(genre?: string | null): string` helper function

**`src/app/mixhive.css`** — add `/* ── Motion ──────────────────────── */` section with:
- `@keyframes shimmer` + `.skeleton` class (doc 41 §3.1)
- `@keyframes toastIn/Out` + `.toast-enter/.toast-exit` classes (doc 41 §3.2)
- `@keyframes panelSlide` + `.panel-enter` class (doc 41 §3.3)
- `@keyframes pageIn` + `.page-enter` class (doc 41 §3.4)
- All `@keyframes` wrapped in `@media (prefers-reduced-motion: no-preference)` where needed

### 2.2 New micro-components

| File | Spec |
|---|---|
| `src/components/HexCell.tsx` | Doc 41 §1 — interactive hex, all variants, sizes, states |
| `src/components/BpmChip.tsx` | Doc 41 §4.1 — range-coded BPM pill |
| `src/components/WaveformAccent.tsx` | Doc 41 §4.2 — 12-bar animated equalizer SVG |
| `src/components/KeyChip.tsx` | Doc 41 §4.3 — Camelot key notation badge |

### 2.3 Hive Composer view

| File | Description |
|---|---|
| `src/views/HiveComposer.tsx` | Main view at route `/composer`; canvas + top bar + save button |
| `src/components/composer/ComposerCanvas.tsx` | Hex grid layout with expansion logic (doc 40 §3) |
| `src/components/composer/SuggestionCell.tsx` | Suggestion variant of HexCell with similarity badge |
| `src/components/composer/ComposerAgentPanel.tsx` | Right 340px panel "Analyse my set" (doc 40 §6) |
| `src/components/composer/BpmGapCell.tsx` | Gap cell variant for BPM mismatch (doc 40 §2) |

Wire into `src/App.tsx`:
```typescript
// Add route:
<Route path="/composer" element={<HiveComposer />} />
```

Add "Composer" to the left nav under a "Create" section (in `src/components/Sidebar.tsx` or
equivalent nav component).

### 2.4 Hive Story view

| File | Description |
|---|---|
| `src/views/HiveStory.tsx` | Story tab content; fetches `get_profile_story` RPC |
| `src/components/story/StoryChapterCell.tsx` | `HexCell` lg/sm wrapper for milestone cells |
| `src/components/story/SoundEvolutionBanner.tsx` | Gradient waveform + evolution markers (doc 42 §4.5) |
| `src/components/story/StoryDetailPanel.tsx` | Right panel chapter detail (doc 42 §4.4) |

**Profile view update:** Add "Story" tab to the profile tab strip in the existing profile view
(`src/views/DjProfile.tsx` or `src/views/Profile.tsx`):

```typescript
// Tab order: Mixes | Playlists | Quests | Story | NFT Passes | About
```

**Settings view update:** Add "Share my journey" toggle to `src/views/Settings.tsx` Profile
section:
- `checked={profile.show_journey}`
- `onChange`: calls `PATCH /api/profiles/[id]` with `{ show_journey: boolean }`

### 2.5 Motion application

After adding keyframes to `mixhive.css`:

- Apply `.skeleton` to existing loading skeleton elements in `FeedCard`, `MixCard`, etc.
  (replace any existing shimmer implementations with the class)
- Apply `.toast-enter/.toast-exit` via `react-hot-toast` `toastOptions.className` in
  `MixHiveClient.tsx` (or wherever toast is configured)
- Apply `.panel-enter` to the right contextual panel when it transitions from hidden → visible
- Apply `.page-enter` to route change wrappers in the main layout

---

## 3. run.py Agent Tasks

### 3.1 Three new `mh.*` functions

Add to `api/lua-agent/run.py` after the existing web3 functions (doc 38):

- `mh.find_similar_mixes(mix_id, k?)` — calls `find_similar_mixes` RPC
- `mh.find_collab_candidates(profile_id, k?)` — calls `find_collab_candidates_hybrid` RPC
- `mh.find_set_continuations(mix_id, bpm_min?, bpm_max?, k?)` — fetches embedding + calls
  `find_mixes_for_set_context` RPC

Add all 3 to: (a) the mh table dict, (b) the docstring at top of run.py.

### 3.2 `set_composer_agent.lua`

**File:** `src/server/lua-agents/agents/set_composer_agent.lua`

An on-demand agent (trigger: `manual`, approval_policy: `on_action`) that analyses a set
in the Hive Composer and proposes transition notes.

Pseudo-behavior:
```lua
function run(ctx)
  local mix_ids = ctx.event.mix_ids or {}
  if #mix_ids < 3 then
    return { status="ok", suggestions={}, tasks={}, notifications={} }
  end

  -- Get energy arc via vector similarity between consecutive mixes
  local observations = {}
  local bpm_values = {}
  for i, mix_id in ipairs(mix_ids) do
    local similar = mh.find_similar_mixes(mix_id, 3)
    -- derive genre from similar results (most common genre tag)
    bpm_values[i] = ctx.event.bpm_map and ctx.event.bpm_map[mix_id] or 0
  end

  -- Build LLM prompt describing the energy arc
  local bpm_range = math.max(table.unpack(bpm_values)) - math.min(table.unpack(bpm_values))
  local arc_desc = bpm_range <= 5 and "steady tempo"
    or bpm_range <= 15 and "gradual build"
    or "dramatic sweep"

  local prompt = string.format(
    "Analyse this %d-track DJ set with a %s BPM arc (%d→%d BPM). " ..
    "Give 1-2 specific observations about the set's flow in plain language. Max 40 words.",
    #mix_ids, arc_desc,
    math.min(table.unpack(bpm_values)), math.max(table.unpack(bpm_values))
  )

  local analysis = mh.llm.call(prompt, "haiku")

  return {
    status = "ok",
    suggestions = {
      suggestion("set_analysis", { analysis=analysis, mix_count=#mix_ids }, 0.85, analysis, false)
    },
    tasks = {},
    notifications = {}
  }
end
```

---

## 4. Phasing and Sequencing

Phase 10 has no hard dependencies between the Codex and Claude Code tracks except:
- Claude Code needs `/api/composer/suggest` to exist before the Hive Composer can make
  live suggestions (can mock with static data during development)
- Claude Code needs `get_profile_story` RPC before HiveStory shows real data
  (can render with mock chapter data)

Recommended 5-week order:

| Week | Track | Work |
|---|---|---|
| 1 | Codex | Migrations 074–075 (HNSW index + RPCs) |
| 2 | Codex | `/api/cron/embed-refresh` + `/api/composer/suggest`; Claude Code: tokens.ts + mixhive.css motion |
| 3 | Claude Code | `HexCell`, `BpmChip`, `WaveformAccent`, `KeyChip` |
| 4 | Claude Code | `HiveComposer` view + `ComposerCanvas` + wiring into nav + App.tsx |
| 5 | Claude Code | `HiveStory` view + `StoryChapterCell` + profile tab + Settings toggle |
| Parallel | run.py | 3 new `mh.*` functions + `set_composer_agent.lua` (can start in week 1) |

---

## 5. Success Criteria

Phase 10 is complete when ALL of the following are true:

### Backend
- [ ] HNSW index live; `find_similar_mixes` p99 latency < 100ms (verify via `EXPLAIN ANALYZE`)
- [ ] `/api/composer/suggest` returns results for a known mix_id
- [ ] `/api/cron/embed-refresh` completes within 60s for 200 rows
- [ ] `profiles.show_journey` column exists in production DB
- [ ] `get_profile_story` RPC returns ≥3 rows for a test profile with mythic edges

### Frontend
- [ ] `/composer` accessible; a 10-track set can be built end-to-end and saved as a playlist
- [ ] Suggestion cells appear after each added track with similarity badges
- [ ] `getGenreColor('techno')` returns the correct HSL string and is applied in MixCard
- [ ] `.skeleton` class applied globally; shimmer visible on loading states
- [ ] Toast notifications use `.toast-enter` animation
- [ ] "Story" tab visible on creator profiles; shows empty state for non-opted-in users
- [ ] "Share my journey" toggle in Settings saves to DB

### Events
- [ ] `vector_suggestion_shown` event fires when suggestion cells render
- [ ] `vector_suggestion_added_to_set` event fires when suggestion is accepted
- [ ] Both events appear in `experiment_events` table

---

## 6. Verification Commands

```bash
# Verify all Phase 10 docs exist and are substantive
ls mixhiveresearch/39-*.md mixhiveresearch/40-*.md mixhiveresearch/41-*.md \
   mixhiveresearch/42-*.md mixhiveresearch/43-*.md
wc -l mixhiveresearch/3{9,9}-*.md mixhiveresearch/4{0,1,2,3}-*.md
# expect: 5 files, each ≥ 200 lines

# After Codex migrations are applied:
npx supabase db diff --linked   # should show HNSW index + new RPCs
psql -c "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM find_similar_mixes('$MIX_ID'::uuid, 10);"
# expect: Index Scan using idx_ai_embeddings_hnsw, ≤100ms

# After Claude Code ships:
npx tsc --noEmit
npm run lint
npm run build
npm run smoke -- --mock-supabase https://mixhive.vercel.app
# expect: all checks pass

# Manual smoke of Hive Composer:
# 1. Navigate to /composer
# 2. Add a mix by search
# 3. Verify 3 suggestion cells appear
# 4. Accept one → verify new suggestions appear from the accepted track
# 5. Save → verify playlist appears in /profile Playlists tab

# Manual smoke of Hive Story:
# 1. Navigate to /profile/:id (user with mythic edges)
# 2. Click Story tab → verify empty state if show_journey=false
# 3. Enable in Settings → verify chapter cells appear
```

---

## 7. What Phase 11 Should Pick Up

Explicitly out of scope for Phase 10 (defer to Phase 11+):

- **Autosave** for Hive Composer draft sets (localStorage + DB persistence)
- **Collaborative Hive Composer** (multi-user real-time, extending doc 27)
- **Live set mode** — real-time BPM display + live vector suggestions during a performance
- **pgvector → dedicated vector DB** migration (Weaviate, Qdrant) — only warranted at > 1M vectors
- **Multi-modal audio embeddings** — embedding actual audio features (MFCC, chroma) instead of
  text-only; would require an audio ML pipeline (out of budget for Phase 10)
- **Cross-platform scene embeddings** — ingesting audio from external platforms (SoundCloud,
  Bandcamp) to enrich scene vectors; requires external API access
- **Hive Story sharing** — generating a shareable image/card of the story timeline for
  social media (Instagram, etc.)
