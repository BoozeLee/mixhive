# 39 — Vector Intelligence and Hybrid Search

**Phase 10 · Architecture Spec**

> Extends: doc 24 (graph query patterns), doc 30 (schema strategies)
> References: migration 030 (`ai_embeddings`), migration 036 (`match_ai_embeddings` RPC),
> `src/server/lua-agents/tools/vector.ts` (existing `vector.embed/search/upsert`)

---

## 1. Embedding Strategy for MIXHIVE's 4 Entity Types

The existing `ai_embeddings` table (migration 030) stores `vector(1536)` embeddings keyed by
`entity_type` + `entity_id`. Phase 10 defines the text construction strategy and refresh lifecycle
for each entity type MIXHIVE needs.

### 1.1 `mix` Embeddings

**Text input:** Concatenated string from available mix metadata:

```
{title}. {description}. Genre: {genre}. Tags: {tags[]}. Mood: {mood}.
Tracklist: {tracklist_track_titles[]}.
```

- Model: `text-embedding-3-small` (1536 dimensions) — same as existing `vector.embed()` call
- Entity key: `mix:{id}`
- Recalculate on:
  - Initial upload (fire immediately in `POST /api/upload` handler)
  - Tag or description edit (`PATCH /api/mixes/[id]`)
  - Tracklist update (from co-production session export or manual edit)
- Average embedding size: ~300 tokens input → well within 8192 token limit

### 1.2 `profile` Embeddings

**Text input:**

```
{display_name}. {bio}. Genres: {genre_tags[]}. Scenes: {scene_tags[]}.
City: {city}. Recent mixes: {last_5_mix_titles[]}.
```

- Entity key: `profile:{id}`
- Recalculate on:
  - Profile save (`PUT /api/profiles/[id]`)
  - Cron refresh every 7 days (ensures recent mixes stay reflected)

### 1.3 `scene` Embeddings (New entity type)

**Concept:** A "scene" is an implicit cluster of artists sharing `similar_artist` edges in the
MythicNode graph. There is no `scenes` table; scenes are derived at query time as the set of
artist_profile nodes reachable within 2 hops via `similar_artist` edges from a seed artist.

**Text input:** Aggregate of the top-20 artists' bios and the top-20 mix titles within the scene:

```
Scene cluster centered on {seed_genre}: {artist_bios[][:100_chars_each]}.
Representative mixes: {mix_titles[]}.
```

- Entity key: `scene:{cluster_id}` where `cluster_id` is a deterministic hash of the seed artist's
  profile_id (the artist with the highest graph degree in the cluster)
- Recalculate: weekly cron only (scenes shift slowly)

### 1.4 `venue` Embeddings (New entity type)

**Text input:**

```
{venue_name} in {city}. Genres hosted: {genres_hosted[]}. Regular artists: {top_5_artist_names[]}.
```

- Entity key: `venue:{node_id}` (node_id from `mythic_nodes` where node_type='venue')
- Recalculate: weekly cron only

### 1.5 What Does NOT Need New Schema

All 4 entity types use the existing `ai_embeddings` table:

```sql
-- existing (migration 030)
create table ai_embeddings (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references profiles(id),
  entity_type  text not null,   -- 'mix' | 'profile' | 'scene' | 'venue'
  entity_id    uuid not null,
  entity_key   text,            -- e.g. 'mix:{uuid}'
  embedding    vector(1536) not null,
  model        text not null default 'text-embedding-3-small',
  version      int not null default 1,
  metadata     jsonb,
  updated_at   timestamptz not null default now()
);
```

Phase 10 introduces no new table — only new `entity_type` values ('scene', 'venue') and new
callers.

---

## 2. Embedding Pipeline Architecture

### 2.1 Synchronous path (upload / save)

Both callers already have access to `vector.ts` from the Lua agent runtime. For server API routes
(Next.js App Router), the equivalent is a direct `fetch` to the OpenAI embeddings endpoint or a
shared utility wrapper:

```typescript
// src/lib/embed-entity.ts (new)
import { createServerClient } from '@/lib/supabase';

export async function embedAndStoreEntity(
  entityType: 'mix' | 'profile' | 'scene' | 'venue',
  entityId: string,
  text: string,
  ownerId?: string
): Promise<void> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  });
  const { data } = await res.json() as { data: [{ embedding: number[] }] };
  const embedding = data[0].embedding;

  const supabase = createServerClient();
  await supabase.from('ai_embeddings').upsert({
    owner_id:    ownerId ?? null,
    entity_type: entityType,
    entity_id:   entityId,
    entity_key:  `${entityType}:${entityId}`,
    embedding:   JSON.stringify(embedding),
    model:       'text-embedding-3-small',
    updated_at:  new Date().toISOString(),
  }, { onConflict: 'entity_type,entity_id' });
}
```

Fire-and-forget from API route handlers — do not await in the request path:

```typescript
// In POST /api/upload after mix row is inserted:
embedAndStoreEntity('mix', mix.id, buildMixText(mix), user.id).catch(console.error);
```

### 2.2 `/api/cron/embed-refresh` (new daily cron)

Schedule: `0 3 * * *` (added to `vercel.json` crons array — Codex handoff).

Algorithm:
1. Query `ai_embeddings` for rows where `updated_at < now() - interval '7 days'` OR where no row
   exists for a given entity (outer join with `mixes`, `profiles`)
2. Limit to 200 rows per run to stay within Vercel function timeout
3. Re-embed each, upsert back
4. Also compute `scene` and `venue` embeddings weekly using aggregate text

The cron runs as a regular Next.js API route at `/api/cron/embed-refresh` protected by
`CRON_SECRET` header.

### 2.3 Lua agent path (existing)

Lua agents can already use:
```lua
vector.upsert("mix", mix_id, mix_text, owner_id)    -- embeds + stores
vector.search(embedding_array, "mix", 10, 0.7)       -- cosine search
```

These call `vector.ts` which calls the OpenAI API + `match_ai_embeddings` RPC. No changes needed.

---

## 3. Four New Retrieval RPCs

These are security-definer functions (Codex migration 075) that wrap cosine search with
domain-specific filters.

### 3.1 `find_similar_mixes(p_mix_id uuid, p_k int)`

```sql
create or replace function public.find_similar_mixes(p_mix_id uuid, p_k int default 10)
returns table (mix_id uuid, title text, similarity float, bpm int)
language sql security definer set search_path = public as $$
  select
    m.id,
    m.title,
    1 - (ae.embedding <=> seed.embedding) as similarity,
    af.bpm::int
  from ai_embeddings seed
  join ai_embeddings ae on ae.entity_type = 'mix'
    and ae.entity_id <> p_mix_id
  join mixes m on m.id = ae.entity_id and m.published = true
  left join audio_features af on af.mix_id = m.id
  where seed.entity_type = 'mix' and seed.entity_id = p_mix_id
  order by ae.embedding <=> seed.embedding
  limit p_k;
$$;
revoke execute on function find_similar_mixes from public;
grant execute on function find_similar_mixes to authenticated, service_role;
```

### 3.2 `find_similar_artists(p_profile_id uuid, p_k int)`

Same pattern: join on entity_type='profile', filter out the seed artist, return
`{profile_id, display_name, similarity}`.

### 3.3 `find_scene_neighbors(p_scene_cluster_id uuid, p_k int)`

Returns similar scene clusters by cosine distance: `{cluster_id, entity_key, similarity}`.
Used for cross-scene discovery ("artists in adjacent scenes").

### 3.4 `find_mixes_for_set_context(p_embedding vector(1536), p_bpm_min int, p_bpm_max int, p_k int)`

The Hive Composer use case — takes an *inline embedding* (from the current set's last track)
rather than looking up a mix_id. Adds BPM constraint via join with `audio_features`:

```sql
create or replace function public.find_mixes_for_set_context(
  p_embedding vector(1536),
  p_bpm_min   int default 0,
  p_bpm_max   int default 999,
  p_k         int default 5
)
returns table (mix_id uuid, title text, similarity float, bpm int, key_camelot text)
language sql security definer set search_path = public as $$
  select
    m.id,
    m.title,
    1 - (ae.embedding <=> p_embedding) as similarity,
    af.bpm::int,
    af.key_camelot
  from ai_embeddings ae
  join mixes m on m.id = ae.entity_id and m.published = true
  left join audio_features af on af.mix_id = m.id
    and (af.bpm between p_bpm_min and p_bpm_max or p_bpm_min = 0)
  where ae.entity_type = 'mix'
  order by ae.embedding <=> p_embedding
  limit p_k;
$$;
```

---

## 4. Hybrid Graph + Vector Query Patterns

### 4.1 Graph-first, Vector-rank (Collab Discovery)

Use case: find artists to collab with — leveraging trust signals (shared venues, mutual followers)
then ranking by sonic similarity.

```sql
with graph_candidates as (
  -- 2-hop traversal from doc 24 pattern
  select distinct e2.to_node_id as artist_node_id
  from mythic_edges e1
  join mythic_edges e2 on e2.from_node_id = e1.to_node_id
  where e1.from_node_id = (
    select id from mythic_nodes where node_type = 'artist_profile'
      and external_id = :seed_profile_id
  )
  and e1.edge_type in ('collab_with', 'performed_at')
  and e2.edge_type in ('collab_with', 'performed_at')
),
candidate_profiles as (
  select n.external_id as profile_id
  from mythic_nodes n
  join graph_candidates gc on gc.artist_node_id = n.id
  where n.node_type = 'artist_profile'
),
seed_embedding as (
  select embedding from ai_embeddings
  where entity_type = 'profile' and entity_id = :seed_profile_id
  limit 1
)
select
  cp.profile_id,
  p.display_name,
  1 - (ae.embedding <=> se.embedding) as similarity
from candidate_profiles cp
join profiles p on p.id = cp.profile_id
join ai_embeddings ae on ae.entity_id = cp.profile_id and ae.entity_type = 'profile'
cross join seed_embedding se
order by ae.embedding <=> se.embedding
limit 10;
```

### 4.2 Vector-first, Graph-filter (Personalized Discovery)

Use case: show a user mixes from the sonic neighborhood that are connected to artists they follow.

```sql
with vector_neighbors as (
  select entity_id as mix_id, 1 - (embedding <=> :query_embedding) as similarity
  from ai_embeddings
  where entity_type = 'mix'
  order by embedding <=> :query_embedding
  limit 50
),
followed_artists as (
  select following_id as profile_id
  from follows
  where follower_id = :viewer_id
)
select vn.mix_id, m.title, vn.similarity
from vector_neighbors vn
join mixes m on m.id = vn.mix_id
join followed_artists fa on fa.profile_id = m.dj_id
order by vn.similarity desc
limit 10;
```

### 4.3 Decision Rule

| Scenario | Approach |
|---|---|
| Collab suggestions | Graph-first, Vector-rank |
| Personalized discovery feed | Vector-first, Graph-filter |
| Hive Composer continuations | Vector-only (no graph constraint; speed matters) |
| Scene exploration | Vector-only (scene embeddings, no graph needed) |

---

## 5. Three New `mh.*` Functions in `run.py`

Added to `api/lua-agent/run.py` alongside the existing web3 functions (doc 38).

### 5.1 `mh.find_similar_mixes(mix_id, k?)`

```python
def find_similar_mixes(mix_id: str, k: int = 10) -> Any:
    """mh.find_similar_mixes(mix_id, k?) → [{mix_id, title, similarity, bpm}]"""
    try:
        resp = _rpc("find_similar_mixes", {"p_mix_id": mix_id, "p_k": k})
        return _python_to_lua_table(lua, resp) if resp else lua.table_from([])
    except Exception:
        return lua.table_from([])
```

### 5.2 `mh.find_collab_candidates(profile_id, k?)`

Calls the hybrid graph+vector pattern via a new RPC `find_collab_candidates_hybrid`:

```python
def find_collab_candidates(profile_id: str, k: int = 10) -> Any:
    """mh.find_collab_candidates(profile_id, k?) → [{profile_id, display_name, similarity}]"""
    try:
        resp = _rpc("find_collab_candidates_hybrid", {"p_profile_id": profile_id, "p_k": k})
        return _python_to_lua_table(lua, resp) if resp else lua.table_from([])
    except Exception:
        return lua.table_from([])
```

### 5.3 `mh.find_set_continuations(mix_id, bpm_min?, bpm_max?, k?)`

```python
def find_set_continuations(mix_id: str, bpm_min: int = 0, bpm_max: int = 999, k: int = 5) -> Any:
    """mh.find_set_continuations(mix_id, bpm_min?, bpm_max?, k?) → [{mix_id, title, similarity, bpm, key_camelot}]"""
    try:
        # Get the seed embedding first
        rows = _db_select("ai_embeddings", {"entity_type": "mix", "entity_id": mix_id}, limit=1)
        if not rows:
            return lua.table_from([])
        embedding = rows[0].get("embedding")
        resp = _rpc("find_mixes_for_set_context", {
            "p_embedding": embedding, "p_bpm_min": bpm_min, "p_bpm_max": bpm_max, "p_k": k
        })
        return _python_to_lua_table(lua, resp) if resp else lua.table_from([])
    except Exception:
        return lua.table_from([])
```

All 3 are added to the `mh` table at runtime and to the docstring block in run.py.

---

## 6. Performance and Caching

### 6.1 HNSW Index (Codex migration 074)

```sql
-- Requires pgvector ≥ 0.5.0 (Supabase has supported HNSW since mid-2024)
create index concurrently if not exists idx_ai_embeddings_hnsw
  on public.ai_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
```

Parameters:
- `m=16` — good balance of recall/speed for ~100K vectors
- `ef_construction=64` — index build quality (higher = better recall, slower build)
- At query time: set `SET hnsw.ef_search = 40;` for p99 < 100ms at 100K rows

### 6.2 Redis Cache

Popular similarity queries are cached in Redis:

- Key: `similar:mix:{mix_id}:k{k}`
- TTL: 1 hour
- Invalidate on: mix embed update
- Cache layer lives in `/api/composer/suggest` and the new similarity RPCs' calling code

### 6.3 Latency Budget

| Operation | Target p99 |
|---|---|
| Sync embed on upload | ≤ 500ms (OpenAI API ≈ 50–100ms + DB upsert ≈ 10ms) |
| Cold cosine query (HNSW, 100K rows) | ≤ 100ms |
| Cached similarity response | ≤ 10ms |
| Cron batch (200 rows) | ≤ 60s (well within 300s Vercel limit) |

---

## 7. Metrics for Vector Discovery

New event types added to `experiment_events` (existing table from migration 065):

| Event | Properties |
|---|---|
| `vector_suggestion_shown` | `{source: 'composer'|'feed', mix_id, suggestion_mix_id, rank, similarity}` |
| `vector_suggestion_added_to_set` | `{mix_id, suggestion_mix_id, set_id, rank, similarity}` |
| `vector_suggestion_dismissed` | `{mix_id, suggestion_mix_id, rank, reason?}` |

**Targets:**
- Hive Composer acceptance rate: ≥ 25% (`added_to_set / shown`)
- Intra-set diversity: avg cosine distance between accepted suggestions ≥ 0.3
- Embed freshness: ≥ 95% of published mixes have an embedding updated within 24h

---

## Codex Handoff

- **Migration 074:** HNSW index on `ai_embeddings.embedding`
- **Migration 075:** 4 security-definer RPCs (`find_similar_mixes`, `find_similar_artists`,
  `find_scene_neighbors`, `find_mixes_for_set_context`) + `find_collab_candidates_hybrid`
- **`/api/cron/embed-refresh`** route + add `{ path: "/api/cron/embed-refresh", schedule: "0 3 * * *" }` to `vercel.json`
- **`/api/composer/suggest`** route (wraps `find_mixes_for_set_context`, requires auth)
- **`src/lib/embed-entity.ts`** utility (shared caller for upload + profile save routes)

## run.py Handoff

- 3 new `mh.*` functions: `find_similar_mixes`, `find_collab_candidates`, `find_set_continuations`
- Add all 3 to `mh` table + docstring in `api/lua-agent/run.py`

## Claude Code Handoff

None (pure backend).
