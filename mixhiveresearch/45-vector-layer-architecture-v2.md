# 45 — Vector Layer Architecture v2

**Phase 12 · Architecture Spec**

> Extends: doc 39 (Phase 10 vector intelligence)
> References: migration 075 (`find_similar_mixes`, `find_similar_artists`, `find_mixes_for_set_context`, `find_collab_candidates_hybrid`), `src/lib/embed-entity.ts`, `api/lua-agent/run.py`

---

## 1. Unified Table Rationale

Phase 10 shipped `ai_embeddings` with `entity_type` + `entity_id` polymorphism and HNSW partial indexes per type (migration 074). Phase 12 **confirms this architecture is correct** — dedicated `mix_embeddings` / `profile_embeddings` tables offer no benefit:

| Factor | Unified `ai_embeddings` | Per-type tables |
|---|---|---|
| HNSW index coverage | One index per entity_type via partial WHERE | Same physical result |
| RPC complexity | `WHERE entity_type = 'mix'` | No join, but 4× more functions |
| Cross-type queries | `WHERE entity_type IN (...)` — natural | Multi-table UNION |
| Schema evolution | Add row, no DDL | New table + migration |
| Maintenance | 1 table, 1 RLS policy | 4 tables, 4 policies |

**Decision:** Retain `ai_embeddings`. Add new `entity_type` values rather than new tables.

---

## 2. Scene Embedding Pipeline

Scenes are implicit clusters — no `scenes` table exists. Phase 12 defines how to produce `entity_type='scene'` embeddings from the graph.

### 2.1 Scene Definition

A "scene" is the set of `artist_profile` nodes reachable within 2 hops via `similar_artist` edges from a seed artist. The seed is represented by a dominant genre tag (e.g. "techno", "drum and bass").

### 2.2 Scene Text Construction

```
Scene: {seed_genre}. Artists: {bio_1[:120]}, {bio_2[:120]}, ...{bio_20[:120]}.
Representative tracks: {mix_title_1}, {mix_title_2}, ...{mix_title_20}.
```

### 2.3 Cron Batch

`/api/cron/embed-refresh` (daily 03:00 — already in `vercel.json`) extended with a scene pass:

```typescript
// After profile refresh pass:
const genreTags = await supabase
  .from('profiles')
  .select('genre_tags')
  .not('genre_tags', 'is', null);

const uniqueGenres = [...new Set(
  genreTags.data?.flatMap(p => p.genre_tags ?? []) ?? []
)].slice(0, 50);

for (const genre of uniqueGenres) {
  // Fetch top-20 artist bios + top-20 mix titles for this genre
  const text = buildSceneText(genre, artistBios, mixTitles);
  const sceneId = await uuidFromGenre(genre); // deterministic UUID from genre string
  await embedAndStoreEntity('scene', sceneId, text);
}
```

**Note:** `uuidFromGenre` is a deterministic UUID v5 derived from the genre string so the same genre always maps to the same entity_id row.

---

## 3. Audio Feature Enhancements (Migration 076)

### 3.1 New Columns

```sql
alter table public.audio_features
  add column if not exists mood   text,
  add column if not exists energy float;
```

`mood` values: `'peak'`, `'groove'`, `'ambient'`, `'transition'` (nullable; set by upload processor or AI inference). `energy` is 0.0–1.0 (nullable).

### 3.2 Extended `find_mixes_for_set_context`

Add optional `p_genre_hint text default null` parameter. When provided, filters to mixes whose `genre` matches case-insensitively:

```sql
and (p_genre_hint is null or lower(m.genre) = lower(p_genre_hint))
```

Full RPC replacement in migration 076 (see doc 49 §1).

---

## 4. `find_collab_candidates_hybrid` — API Surface

The RPC exists (migration 075) but is not yet exposed in any frontend or Lua API. Phase 12 specifies the surface:

### 4.1 API Endpoint (future Codex task)

`POST /api/collab/candidates`
- Auth required
- Body: `{ k?: number }` (default 5)
- Calls `find_collab_candidates_hybrid(p_profile_id, p_k)`
- Returns: `[{ profile_id, username, similarity, graph_score, genre_tags }]`

### 4.2 Lua API Addition

In `api/lua-agent/run.py`, new `mh.find_collab_candidates(k)` function backed by the RPC — mirrors the pattern of `mh.find_similar_mixes`.

### 4.3 Collab Cartographer Integration

The Collab Cartographer agent (`collab_cartographer.lua`) currently uses `mh.get_scene_peers`. Phase 12 adds a hybrid branch:

```lua
local candidates = mh.find_collab_candidates(5)
if #candidates > 0 then
  -- use hybrid results as primary; fall back to scene_peers if empty
end
```

---

## 5. Caching Strategy

### 5.1 Redis Key Schema

```
similar:mix:{mix_id}:k{k}         TTL 1h
similar:profile:{profile_id}:k{k} TTL 1h
collab:{profile_id}:k{k}          TTL 6h
```

### 5.2 Invalidation

On `ai_embeddings` upsert for a given `entity_id`, delete the corresponding cache key. The embed-refresh cron does this naturally since it overwrites existing keys.

### 5.3 Current State

Redis is not wired to the similarity RPCs in Phase 10/11. The RPCs hit HNSW directly. Adding Redis caching is a Codex task for high-traffic paths (> 100 req/min on the same mix_id).

---

## 6. Metrics (Phase 12 Additions)

Extending the vector metrics from doc 39 §7:

| Event | When | Properties |
|---|---|---|
| `vector_suggestion_shown` | On suggestions fetch in Hive Composer | `suggestion_mix_id`, `rank`, `similarity` |
| `vector_suggestion_added_to_set` | On suggestion accept | `mix_id`, `similarity` |
| `vector_suggestion_dismissed` | On suggestion dismiss (**new Phase 12**) | `mix_id` |
| `vector_filter_applied` | On genre/BPM chip click (**new Phase 12**) | `genre_filter`, `bpm_range` |

Target acceptance rate: ≥ 25%. Dismiss rate target: ≤ 40%.
