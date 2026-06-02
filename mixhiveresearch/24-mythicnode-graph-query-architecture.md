# MythicNode Graph Query Architecture (Phase 7)

**"The schema is live. Now make it fast, queryable, and useful at scale."**

**Status:** Architecture spec — ready for Codex implementation  
**Date:** 31 May 2026  
**Extends:** `13-mythicnode-graph-and-agent-api.md` (schema) · `14-mythicnode-followups.md` (derivation) · `21-mythic-tour-weaver-prd.md` (venue nodes)  
**Owner split:** Codex (migrations, RPCs, workers) · Claude Code (no handoff from this doc — pure infra)

---

## 1. Event-to-Edge Ingestion Map

Every domain event in MIXHIVE that has career significance should write one or more entries into MythicNode. The table below maps each event to its graph output, the mechanism that fires it, and its latency class.

| Domain event | Node created/updated | Edge created | Mechanism | Latency |
|---|---|---|---|---|
| Mix published (`mixes.published = true`) | `mix` node (`source_table=mixes`) | `published_by` (mix → artist_profile) | DB trigger on UPDATE | Synchronous |
| Mix played (play_count increment) | — | `listened_by` (artist_profile → mix) | Background worker via `mythic_graph_jobs` | Async ≤5 min |
| Mix liked | — | `liked_by` (profile → mix) | `mythic_graph_jobs` job enqueued from likes table trigger | Async ≤5 min |
| Follow created | — | `followed` (profile → profile) | DB trigger on INSERT into follows | Synchronous |
| Gig logged (Tour Weaver) | `event` node, `venue` node (upsert by name+city) | `performed_at` (artist → event), `hosted_by` (event → venue) | API route `POST /api/mythic/propose` → immediate | Synchronous |
| Opportunity applied | — | `submitted_to` (artist → opportunity) | `opportunity_applications` INSERT trigger | Synchronous |
| Outcome recorded on opportunity | — | `yielded_outcome` (mix/post → opportunity) | Background job fired from `opportunity_saves` UPDATE | Async ≤1 min |
| Collab session created | `collab_session` node | `collab_with` (artist ↔ artist, status=pending) | API route `POST /api/mythic/sessions` | Synchronous |
| Collab session participant joins | — | Update `collab_with` edge metadata: `confirmed_at` set | Realtime presence event → background job | Async ≤30s |
| Mix exported from collab session | — | `session_produced_mix` (collab_session → mix) | API route on export action | Synchronous |
| Agent recommendation surfaced | — | `recommended_by_agent` (agent → target_node) | Strategic agent run (wasmoon) | Synchronous |
| Quest milestone completed | — | `quest_milestone_achieved` (quest → mix/event/opp) | Route `POST /api/quests/{id}/milestones/{mid}/complete` | Synchronous |

### Ingestion rules

**Fire-and-forget for async paths.** Wrap every `mythic_graph_jobs.insert()` in a try/except — never let graph derivation block a user-facing write.

**Idempotency.** All edge upserts use `ON CONFLICT (from_node_id, to_node_id, edge_type) DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = now()` to prevent duplicates on replay.

**Audit trail.** Every `mythic_edges` row carries `source_event` (the name of the triggering event) and `metadata` (event payload subset). This makes attribution auditable — the Yield Analyst can trace any edge back to its origin.

---

## 2. Canonical Query Patterns

These are the 6 queries that the existing Lua agents, new discovery agents (doc 25), and API routes depend on most. Each is expressed as a SQL sketch and a description of the indexes it needs.

### 2.1 Similar Artists (graph overlap)

**Use case:** `mh.get_similar_artists()`, mythic_strategist, Scene Navigator  
**Algorithm:** Find artists who share `performed_at` or `collab_with` neighbors with the seed artist, ranked by overlap count.

```sql
-- Seed artist: $owner_id (as artist_profile node id)
WITH seed_neighbors AS (
  SELECT target_id AS node_id
  FROM mythic_edges
  WHERE source_id = $artist_node_id
    AND edge_type IN ('performed_at', 'collab_with', 'liked_by')
),
peer_artists AS (
  SELECT me.source_id AS artist_node_id, count(*) AS shared_count
  FROM mythic_edges me
  JOIN seed_neighbors sn ON me.target_id = sn.node_id
  WHERE me.edge_type IN ('performed_at', 'collab_with', 'liked_by')
    AND me.source_id != $artist_node_id
  GROUP BY me.source_id
  HAVING count(*) >= 2
)
SELECT pa.artist_node_id, pa.shared_count, p.username, p.display_name
FROM peer_artists pa
JOIN mythic_nodes mn ON mn.id = pa.artist_node_id AND mn.node_type = 'artist_profile'
JOIN profiles p ON p.id = mn.owner_id
ORDER BY pa.shared_count DESC
LIMIT $limit;
```

**Indexes required:**
- `mythic_edges(source_id, edge_type)` — covering index for the inner join
- `mythic_edges(target_id, edge_type)` — covering index for the seed_neighbors lookup
- `mythic_nodes(node_type, owner_id)` — for the final join to profiles

---

### 2.2 Two-Hop Venue Discovery

**Use case:** Scene Navigator discovering high-leverage venues nearby  
**Algorithm:** Artist → `performed_at` → events → `hosted_by` → venues → `hosted_by` → other events → `performed_at` → peer artists at those venues.

```sql
-- Step 1: venues directly connected to artist
WITH artist_venues AS (
  SELECT e2.target_id AS venue_id
  FROM mythic_edges e1
  JOIN mythic_edges e2 ON e2.source_id = e1.target_id AND e2.edge_type = 'hosted_by'
  WHERE e1.source_id = $artist_node_id AND e1.edge_type = 'performed_at'
),
-- Step 2: all artists who also played those venues
peer_artists_at_venue AS (
  SELECT e3.source_id AS peer_artist_id, av.venue_id, count(*) AS shared_venue_count
  FROM mythic_edges e3
  JOIN mythic_edges e4 ON e4.target_id = av.venue_id AND e4.source_id = e3.target_id AND e4.edge_type = 'hosted_by'
  JOIN artist_venues av ON av.venue_id = e4.target_id
  WHERE e3.edge_type = 'performed_at'
    AND e3.source_id != $artist_node_id
  GROUP BY e3.source_id, av.venue_id
)
SELECT pav.peer_artist_id, sum(pav.shared_venue_count) AS total_venue_overlap,
       mn_v.title AS venue_name
FROM peer_artists_at_venue pav
JOIN mythic_nodes mn_v ON mn_v.id = pav.venue_id
GROUP BY pav.peer_artist_id, mn_v.title
ORDER BY total_venue_overlap DESC
LIMIT $limit;
```

**Indexes required:**
- `mythic_edges(source_id, edge_type, target_id)` — 3-column composite, covers hop traversal
- `mythic_nodes(node_type, id)` — for venue/event type filtering in deeper traversals

---

### 2.3 Opportunity Ranking

**Use case:** `mh.get_relevant_opportunities()` (live in migration 064), Opportunity Scout  
**Algorithm:** Score open opportunities by: genre overlap with artist's recent mixes (×3), deadline proximity (0–7 bonus), city match (+2). Already implemented in `lua_get_relevant_opportunities()`. Document this as the canonical pattern.

For the agent surface, the scoring formula is:
```
score = (genre_overlap_count × 3) + min(7, max(0, 14 - days_to_deadline)) + city_match_bonus
```

**Extensions for Phase 8:** incorporate `submitted_to` edge count (penalize opportunities where artist has already applied) and `yielded_outcome` edge recency on similar opportunities (boost opportunities that have historically produced outcomes for similar artists).

---

### 2.4 Quest Momentum Signal

**Use case:** `lua_get_quest_momentum()` (live), `quest-momentum-watcher` starter agent  
**Algorithm:** For each active quest: `milestones_done / milestones_total` × recency factor (quests with recent milestone activity score higher).

Current implementation in migration 064 uses a simple `count(milestones where status='completed') / count(all milestones)` ratio. For Phase 8, extend with:

```sql
-- Recency-weighted momentum
SELECT q.id,
  (count(qm.id) FILTER (WHERE qm.status = 'completed'))::float /
  nullif(count(qm.id), 0) AS raw_momentum,
  -- Recency decay: milestone completed in last 7 days = full credit
  sum(CASE WHEN qm.completed_at > now() - interval '7 days' THEN 1.0
           WHEN qm.completed_at > now() - interval '30 days' THEN 0.5
           ELSE 0.1 END) FILTER (WHERE qm.status = 'completed') AS recency_score
FROM quests q
LEFT JOIN quest_milestones qm ON qm.quest_id = q.id
WHERE q.owner_id = $owner_id AND q.status IN ('active', 'paused')
GROUP BY q.id;
```

---

### 2.5 Scene Membership (k=2 Cluster)

**Use case:** Scene Navigator archetype (doc 25), future scene leaderboard  
**Algorithm:** Start from the artist's `similar_artist` edges; collect all artists reachable in k=2 hops; use the modal scene_tags from their profiles as the "dominant scene".

```sql
WITH k1 AS (
  SELECT target_id FROM mythic_edges
  WHERE source_id = $artist_node_id AND edge_type = 'similar_artist'
),
k2 AS (
  SELECT me.target_id FROM mythic_edges me
  JOIN k1 ON k1.target_id = me.source_id
  WHERE me.edge_type = 'similar_artist'
  UNION SELECT target_id FROM k1
),
scene_artists AS (
  SELECT mn.owner_id FROM mythic_nodes mn
  JOIN k2 ON k2.target_id = mn.id
  WHERE mn.node_type = 'artist_profile'
),
scene_tags_unnested AS (
  SELECT unnest(p.genres) AS tag
  FROM profiles p JOIN scene_artists sa ON sa.owner_id = p.id
)
SELECT tag, count(*) AS frequency
FROM scene_tags_unnested
GROUP BY tag
ORDER BY frequency DESC
LIMIT 5;
```

**Indexes required:** `mythic_edges(edge_type, source_id)` for the outer hop

---

### 2.6 Agent Suggestion Deduplication

**Use case:** All strategic and user agents — prevent surfacing the same recommendation within a 30-day window  
**Algorithm:** Before surfacing any recommendation, check for a `recommended_by_agent` edge from agent to target created in the last 30 days.

```sql
SELECT 1 FROM mythic_edges
WHERE source_id = $agent_node_id
  AND target_id = $target_node_id
  AND edge_type = 'recommended_by_agent'
  AND created_at > now() - interval '30 days'
LIMIT 1;
```

This is the gate condition. If the result is non-empty, skip the recommendation.

**Indexes required:** `mythic_edges(source_id, target_id, edge_type, created_at)` — 4-column composite

---

## 3. Index Specification

All indexes should be added in a single migration (`065_mythicnode_query_indexes.sql`). Until then, the existing `mythic_edges(from_node_id)` and `(to_node_id)` indexes from migration 045 handle basic traversal but will degrade beyond 50K edges.

**New indexes for Codex to add:**

```sql
-- Pattern 2.1 and 2.2: edge traversal by type
CREATE INDEX IF NOT EXISTS idx_mythic_edges_source_type_target
  ON mythic_edges (source_id, edge_type, target_id);

CREATE INDEX IF NOT EXISTS idx_mythic_edges_target_type_source
  ON mythic_edges (target_id, edge_type, source_id);

-- Pattern 2.5: scene cluster traversal
CREATE INDEX IF NOT EXISTS idx_mythic_edges_type_source
  ON mythic_edges (edge_type, source_id);

-- Pattern 2.6: agent suggestion dedup (with time window)
CREATE INDEX IF NOT EXISTS idx_mythic_edges_source_target_type_created
  ON mythic_edges (source_id, target_id, edge_type, created_at DESC);

-- Nodes: type + owner lookup
CREATE INDEX IF NOT EXISTS idx_mythic_nodes_type_owner
  ON mythic_nodes (node_type, owner_id);

-- Nodes: type + source table lookup (for external ref resolution)
CREATE INDEX IF NOT EXISTS idx_mythic_nodes_source_table_source_id
  ON mythic_nodes (source_table, source_id);
```

---

## 4. Materialized Views (Future — Phase 8)

These views are expensive to compute inline but cheap to refresh on a schedule. Define them now; let Codex implement them when the graph reaches 10K+ nodes.

### 4.1 `mv_artist_similarity_scores`

Pre-computes the similar-artist scores for all artist pairs with ≥2 shared neighbors. Refreshed hourly via `mythic_graph_jobs`.

```sql
CREATE MATERIALIZED VIEW mv_artist_similarity_scores AS
SELECT
  source_id AS artist_a,
  target_artist AS artist_b,
  count(*) AS shared_neighbor_count,
  now() AS refreshed_at
FROM (
  -- both artists share a common intermediate node via same edge type
  SELECT e1.source_id, e2.source_id AS target_artist
  FROM mythic_edges e1
  JOIN mythic_edges e2 ON e2.target_id = e1.target_id
    AND e2.edge_type = e1.edge_type
    AND e2.source_id != e1.source_id
  WHERE e1.edge_type IN ('performed_at', 'collab_with')
) sub
GROUP BY source_id, target_artist
HAVING count(*) >= 2;

CREATE INDEX ON mv_artist_similarity_scores (artist_a, shared_neighbor_count DESC);
```

### 4.2 `mv_venue_impact_by_genre`

Pre-computes the venue impact score (see section 5) per venue per genre. Refreshed daily.

### 4.3 `mv_scene_cluster_membership`

Pre-computes the dominant scene cluster for each artist. Refreshed weekly. Used by the Scene Navigator agent to skip the k=2 traversal at runtime.

---

## 5. Artist-Venue Graph

### 5.1 Node and Edge Types

Artist-venue relationships use three node types and four edge types already defined in migration 045:

- **Nodes:** `artist_profile`, `event`, `venue`
- **Edges:**
  - `performed_at` (artist_profile → event) — each gig logged via Tour Weaver
  - `hosted_by` (event → venue) — the venue that hosted the event
  - `booked_by` (venue → artist_profile) — explicit booking invitation (rare; requires BookingScout confirmation)
  - `similar_venue` (venue → venue) — derived; two venues that frequently host overlapping artist sets

### 5.2 Venue Impact Score

A venue's impact on an artist's career can be approximated without external graph ranking libraries by:

```
venue_impact_score = (
    log(1 + plays_in_30d_after_gig)   -- streaming uplift proxy
  × genre_match_weight                 -- 1.0 if venue's top genre matches artist's, 0.5 otherwise
  × recency_weight                     -- 1.0 if performed < 6 months ago, 0.5 if < 2 years, 0.1 otherwise
  × event_size_weight                  -- 1.0 for capacity > 500, 0.7 for 100-500, 0.4 for < 100
)
```

In practice `plays_in_30d_after_gig` is approximated by comparing `mix.play_count` before and after the `performed_at` event's `occurred_at` timestamp. This is imprecise but good enough for ranking.

Postgres implementation sketch:

```sql
CREATE OR REPLACE FUNCTION venue_impact_score(
  p_venue_node_id uuid,
  p_artist_node_id uuid,
  p_genre text
) RETURNS float LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_event_count int;
  v_genre_match float;
BEGIN
  SELECT count(*) INTO v_event_count
  FROM mythic_edges e1
  JOIN mythic_edges e2 ON e2.source_id = e1.target_id AND e2.edge_type = 'hosted_by'
  WHERE e1.source_id = p_artist_node_id
    AND e1.edge_type = 'performed_at'
    AND e2.target_id = p_venue_node_id;

  -- Simplified: each event at this venue counts as 1 unit of impact
  -- Phase 8: incorporate streaming uplift window
  RETURN least(v_event_count::float / 10.0, 1.0);
END;
$$;
```

**BiRank / VenueRank path (Phase 8):** Once the graph reaches 10K+ edges, replace the above with a proper bipartite ranking algorithm (BiRank: Bi, et al. 2017) that iterates artist-to-venue and venue-to-artist influence scores until convergence. This is a background job, not an inline query.

### 5.3 Artist-Venue Fit Score

How well does an artist fit a particular venue?

```
venue_fit_score = (
    venue_impact_score(venue, artist, genre)
  × genre_overlap_with_venue_regular_artists   -- 0.0–1.0
  × (1 + collab_with_venue_regulars_count)     -- bonus if artist already knows people who play there
)
```

This score is used by the Booking Scout agent (`booking_scout.lua`) to rank venue suggestions.

---

## 6. At-Scale Limits

| Constraint | Limit | Reason |
|---|---|---|
| Max traversal depth | 3 hops | Beyond 3 hops, result sets explode; use materialized views instead |
| Max inline result set | 5,000 edges | Beyond this, require a materialized view or paginated cursor |
| Max agent recommendation age | 30 days | See dedup query in section 2.6 |
| Max graph nodes before mv refresh | 10,000 | Below this, inline queries are fast enough |
| Node embedding refresh lag | 24 hours | `ai_embeddings` table refresh job via `mythic_graph_jobs` |
| Max `similar_artist` edges per artist | 50 | Capped in `find_similar_artists_by_graph_overlap` RPC |

### Degradation strategy

When the graph grows beyond 50K edges, the strategy is:
1. Switch `similar_artist` queries to read from `mv_artist_similarity_scores` instead of inline traversal
2. Add a read-through cache in Redis (TTL 1 hour) for the top-N similar artists per user — the `mh.get_similar_artists()` tool already uses `try/except` fail-open, so a cache miss falls through to the DB
3. Defer venue-level ranking to async background refresh; serve stale-ok from a `venue_scores` table

---

## Codex Handoff Summary

**Migration 065** (`065_mythicnode_query_indexes.sql`):
- 6 composite indexes on `mythic_edges` and `mythic_nodes` (section 3)
- `venue_impact_score()` function (section 5.2)
- Stubs for 3 materialized views (section 4) — CREATE but don't populate yet

**Migration 066** (Phase 8, when graph reaches 10K nodes):
- Populate `mv_artist_similarity_scores`
- Add refresh job to `mythic_graph_jobs` worker

**No Claude Code handoff from this document** — all infra.
