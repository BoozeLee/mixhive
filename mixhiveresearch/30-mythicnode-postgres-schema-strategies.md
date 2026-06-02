# Doc 30 — MythicNode Postgres Schema Strategies

Phase 8 infra spec. Extends doc 24 (query patterns + indexes). Codex implementation handoff.

Doc 24 covers HOW to query the graph. This doc covers HOW to structure the schema itself for
Postgres best practices: polymorphic references, edge weights, recursive CTE templates,
materialized view strategy, JSONB conventions, and the Apache AGE upgrade path.

---

## 1. Refined Node Schema

The current `mythic_nodes` table stores nodes with a `node_type` discriminator. Phase 8 adds a
**polymorphic reference** pattern so agent queries can `JOIN` back to the canonical source row
without duplicating data.

```sql
-- Target schema for mythic_nodes
CREATE TABLE IF NOT EXISTS mythic_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type       TEXT NOT NULL,
  -- Polymorphic back-reference to the canonical Postgres row
  external_table  TEXT,             -- e.g. 'profiles', 'mixes', 'nft_collections'
  external_id     UUID,             -- FK to the row in that table (not enforced at DB level)
  props           JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Why `external_table` + `external_id` instead of separate FK columns:**
- A node can represent any entity. Adding one nullable FK per entity type leads to sparse,
  wide tables (dozens of NULL columns per row).
- The polymorphic pattern keeps the schema stable as new entity types are added — only a new
  `node_type` value and a new `external_table` string are needed, no DDL migration.
- `JOIN` back to source is still possible:
  ```sql
  SELECT n.*, p.display_name
  FROM mythic_nodes n
  JOIN profiles p ON p.id = n.external_id
  WHERE n.node_type = 'artist_profile'
    AND n.external_table = 'profiles';
  ```
- No DB-level FK enforcement on `external_id` (can't enforce polymorphic FKs in Postgres
  without triggers). Application logic enforces referential integrity on write.

**Migration note:** If `external_table` and `external_id` columns do not exist on the current
production `mythic_nodes` table, Codex should add them via a new migration (NOT NULL-safe,
add as nullable with a backfill strategy).

---

## 2. Refined Edge Schema

```sql
CREATE TABLE IF NOT EXISTS mythic_edges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id  UUID NOT NULL REFERENCES mythic_nodes(id) ON DELETE CASCADE,
  to_node_id    UUID NOT NULL REFERENCES mythic_nodes(id) ON DELETE CASCADE,
  edge_type     TEXT NOT NULL,
  weight        FLOAT NOT NULL DEFAULT 1.0,
  props         JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`weight` column rationale:** A default weight of 1.0 keeps all existing queries unchanged.
Future PageRank-style or BiRank scoring (see doc 24 §5) can write computed weights back to
this column without schema changes. Weight semantics per edge type:

| edge_type | weight meaning |
|---|---|
| `collab_with` | 1.0 + (number of shared collabs, incremented) |
| `performed_at` | venue_impact_score (float 0–10, from doc 24 formula) |
| `similar_artist` | cosine similarity of genre + scene vectors (0.0–1.0) |
| `owns_nft_of` | 1.0 always (binary ownership) |
| `backed_quest` | backing_amount_normalised (0.0–1.0) |

---

## 3. Index Specification

Six base indexes cover the canonical query patterns from doc 24. These complement the
query-specific composite indexes already specified there.

```sql
-- Base structural indexes
CREATE INDEX IF NOT EXISTS idx_nodes_type
  ON mythic_nodes (node_type);

-- Polymorphic back-reference lookup (new in Phase 8)
CREATE INDEX IF NOT EXISTS idx_nodes_ext
  ON mythic_nodes (external_table, external_id)
  WHERE external_id IS NOT NULL;

-- Outbound traversal (agents ask "what can I reach from node X?")
CREATE INDEX IF NOT EXISTS idx_edges_from
  ON mythic_edges (from_node_id);

-- Inbound traversal (agents ask "who points to node X?")
CREATE INDEX IF NOT EXISTS idx_edges_to
  ON mythic_edges (to_node_id);

-- Type-filtered outbound (most common agent pattern)
CREATE INDEX IF NOT EXISTS idx_edges_type_from
  ON mythic_edges (edge_type, from_node_id);

-- Type-filtered inbound
CREATE INDEX IF NOT EXISTS idx_edges_type_to
  ON mythic_edges (edge_type, to_node_id);
```

**When to add partial indexes:** When a single `edge_type` accounts for > 30% of rows,
a partial index on that type reduces index size and speeds scans:

```sql
-- Example: collab_with edges are the most queried type
CREATE INDEX IF NOT EXISTS idx_edges_collab_from
  ON mythic_edges (from_node_id)
  WHERE edge_type = 'collab_with';
```

Add partial indexes only after production query analysis (EXPLAIN ANALYZE), not preemptively.

---

## 4. Traversal Patterns

### 4.1 When to Use CTE vs. Direct JOIN

| Scenario | Strategy |
|---|---|
| 1 hop, simple edge type | Direct JOIN (fastest) |
| 2 hops, known start set < 500 nodes | Two sequential JOINs |
| 3+ hops | Recursive CTE with visited guard |
| Result set > 5,000 edges | Materialized view (see §5) |
| Daily analytics | Scheduled materialized view refresh |

### 4.2 Recursive CTE Template

```sql
WITH RECURSIVE graph_traverse AS (
  -- Base case: direct neighbours of the start node
  SELECT
    e.to_node_id  AS node_id,
    1             AS depth,
    ARRAY[start_node_id, e.to_node_id] AS path,
    e.weight      AS accumulated_weight
  FROM mythic_edges e
  WHERE e.from_node_id = :start_node_id     -- bind parameter
    AND e.edge_type    = :edge_type          -- bind parameter
    AND e.to_node_id  <> :start_node_id      -- avoid immediate self-loop

  UNION ALL

  -- Recursive case: one more hop
  SELECT
    e.to_node_id,
    g.depth + 1,
    g.path || e.to_node_id,
    g.accumulated_weight * e.weight
  FROM mythic_edges e
  JOIN graph_traverse g ON g.node_id = e.from_node_id
  WHERE g.depth < :max_depth               -- depth guard (use 3 as default)
    AND e.edge_type = :edge_type
    AND NOT (e.to_node_id = ANY(g.path))   -- cycle guard (visited set via path array)
)
SELECT DISTINCT node_id, depth, path, accumulated_weight
FROM graph_traverse
ORDER BY accumulated_weight DESC
LIMIT :limit;
```

**Bind parameters:**
- `:start_node_id` — UUID of the origin node
- `:edge_type` — single edge type (run multiple CTEs for multi-type traversals, UNION results)
- `:max_depth` — hard cap, default 3; never expose this as a user-controlled parameter
- `:limit` — result cap, default 20

**Cycle guard:** The `NOT (e.to_node_id = ANY(g.path))` check prevents infinite loops in
undirected-equivalent graphs (e.g. `similar_artist` edges go both ways). The `path` array
also serves as the provenance trace shown in the graph insight callout ("via Speedy J → Metalheadz Night").

**Multi-type traversal (Scene Navigator use case):**

```sql
-- Artists connected via ANY of: collab_with, similar_artist, or performed_at-event-performed_at
WITH base AS (
  SELECT DISTINCT to_node_id AS node_id
  FROM mythic_edges
  WHERE from_node_id = :artist_node_id
    AND edge_type IN ('collab_with', 'similar_artist')
)
SELECT n.*, p.display_name
FROM base b
JOIN mythic_nodes n ON n.id = b.node_id AND n.node_type = 'artist_profile'
JOIN profiles p ON p.id = n.external_id
LIMIT 20;
```

---

## 5. Materialized View Strategy

Three views are worth precomputing (specified in doc 24 §4, expanded here with refresh strategy):

### 5.1 `mv_artist_similarity_scores`

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_artist_similarity_scores AS
SELECT
  e.from_node_id  AS artist_a,
  e.to_node_id    AS artist_b,
  e.weight        AS similarity_score,
  e.props->>'genre_overlap' AS genre_overlap,
  e.created_at
FROM mythic_edges e
WHERE e.edge_type = 'similar_artist'
WITH DATA;

CREATE UNIQUE INDEX ON mv_artist_similarity_scores (artist_a, artist_b);
```

Refresh schedule: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artist_similarity_scores`
every hour via pg_cron (`0 * * * *`). Use `CONCURRENTLY` to avoid locking reads during refresh.
Requires the unique index above.

### 5.2 `mv_venue_impact_by_genre`

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_venue_impact_by_genre AS
SELECT
  venue_node.id          AS venue_node_id,
  edge.props->>'genre'   AS genre,
  COUNT(*)               AS event_count,
  AVG((edge.props->>'event_size')::int)          AS avg_event_size,
  AVG((edge.props->>'post_event_uptick')::float)  AS avg_uptick,
  SUM(edge.weight)       AS total_impact_score
FROM mythic_edges edge
JOIN mythic_nodes venue_node ON venue_node.id = edge.to_node_id
  AND venue_node.node_type = 'venue'
WHERE edge.edge_type = 'hosted_by'
GROUP BY venue_node.id, edge.props->>'genre'
WITH DATA;
```

Refresh schedule: once daily at 03:00 UTC (lower frequency acceptable; venue data is slow-moving).

### 5.3 `mv_scene_cluster_membership`

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_scene_cluster_membership AS
WITH two_hop AS (
  SELECT e1.from_node_id AS artist_a, e2.to_node_id AS artist_b
  FROM mythic_edges e1
  JOIN mythic_edges e2 ON e2.from_node_id = e1.to_node_id
  WHERE e1.edge_type = 'similar_artist'
    AND e2.edge_type = 'similar_artist'
    AND e1.from_node_id <> e2.to_node_id
)
SELECT
  artist_a,
  artist_b,
  COUNT(*) AS shared_connections
FROM two_hop
GROUP BY artist_a, artist_b
HAVING COUNT(*) >= 2
WITH DATA;

CREATE INDEX ON mv_scene_cluster_membership (artist_a);
```

Refresh schedule: daily at 04:00 UTC. This view is the foundation for the Scene Navigator
agent's "peers in your scene" query.

---

## 6. JSONB Props Conventions

`props` fields hold flexible metadata that doesn't warrant its own column. Conventions prevent
the JSONB from becoming an unstructured dumping ground.

### 6.1 Node Type Props

| node_type | Standard props keys |
|---|---|
| `artist_profile` | `genre_tags: string[]`, `city: string`, `availability: 'open'|'limited'|'closed'` |
| `mix` | `duration_seconds: int`, `bpm: float`, `key: string`, `genre: string` |
| `venue` | `city: string`, `capacity: int`, `genre_focus: string[]` |
| `event` | `event_date: ISO8601`, `event_size: int`, `genre: string`, `venue_node_id: UUID` |
| `opportunity` | `deadline: ISO8601`, `type: 'booking'|'label'|'grant'`, `city: string` |
| `quest` | `phase: string`, `target_date: ISO8601`, `category: string` |
| `collab_session` | `participant_ids: UUID[]`, `status: 'active'|'review'|'ended'` |
| `nft_collection` | `chain: string`, `max_supply: int`, `soulbound: bool` |

### 6.2 Edge Type Props

| edge_type | Standard props keys |
|---|---|
| `performed_at` | `event_date: ISO8601`, `event_size: int`, `venue_node_id: UUID`, `post_event_uptick: float` |
| `collab_with` | `session_id: UUID`, `confirmed_at: ISO8601` |
| `similar_artist` | `genre_overlap: float`, `scene_tags: string[]`, `computed_at: ISO8601` |
| `recommended_by_agent` | `agent_id: string`, `shown_at: ISO8601`, `rank: int` |
| `owned_nft_of` | `token_id: UUID`, `minted_at: ISO8601` |
| `backed_quest` | `backing_token_id: UUID` |

**Rules:**
1. Never store computed/derived values that can be recalculated from other columns (e.g. do not
   store `total_plays` in `props` if it can be aggregated from a `play_events` table).
2. Store ISO 8601 strings for dates in JSONB (not Unix timestamps — human-readable in psql).
3. Maximum `props` size: 8KB. Reject writes that exceed this at the application layer.
4. Index JSONB keys only if they appear in WHERE clauses in canonical queries:
   ```sql
   CREATE INDEX idx_edges_performed_at_date
     ON mythic_edges ((props->>'event_date'))
     WHERE edge_type = 'performed_at';
   ```

---

## 7. Apache AGE / Graph Extension Upgrade Path

Apache AGE (A Graph Extension for Postgres) adds a Cypher query layer on top of Postgres. It
is **not required in Phase 8** but becomes attractive at specific thresholds.

### 7.1 When to Evaluate AGE

Trigger the evaluation when **any two** of the following are true:

- `mythic_edges` exceeds 500,000 rows
- Agents require traversals > 5 hops
- Recursive CTE query time exceeds 200ms at the 90th percentile (check via Supabase slow query log)
- The team wants to write traversal logic in Cypher rather than SQL

### 7.2 Migration Strategy

AGE is purely additive. It creates an `ag_catalog` schema and graph storage alongside your
existing tables. The migration path:

1. Enable AGE extension: `CREATE EXTENSION IF NOT EXISTS age;`
2. Create a named graph: `SELECT * FROM ag_catalog.create_graph('mixhive');`
3. Load existing data via a one-time script:
   ```sql
   -- Insert artist nodes
   SELECT ag_catalog.cypher('mixhive', $$
     CREATE (n:ArtistProfile { node_id: $node_id, city: $city })
   $$, row_to_json(t)) AS (result ag_catalog.agtype)
   FROM (SELECT id AS node_id, props->>'city' AS city FROM mythic_nodes
         WHERE node_type = 'artist_profile') t;
   ```
4. Keep `mythic_nodes` / `mythic_edges` as the write-authoritative source. AGE graph is a
   **read replica** rebuilt on demand for complex traversals.
5. New Cypher queries run via `ag_catalog.cypher(...)` in Postgres functions; agents call them
   as normal Supabase RPCs.

**Do not migrate to AGE-only storage.** Supabase tooling (RLS, triggers, realtime) operates on
the Postgres tables, not the AGE graph. Dual-write would be fragile.

---

## 8. Codex Handoff

**Migration (next numbered, e.g. 067):**

```sql
-- Migration 067: Phase 8 — mythic_nodes polymorphic ref + Phase 8 indexes

BEGIN;

-- Add polymorphic back-reference columns (nullable; backfill separately)
ALTER TABLE mythic_nodes
  ADD COLUMN IF NOT EXISTS external_table TEXT,
  ADD COLUMN IF NOT EXISTS external_id    UUID;

-- Polymorphic lookup index
CREATE INDEX IF NOT EXISTS idx_nodes_ext
  ON mythic_nodes (external_table, external_id)
  WHERE external_id IS NOT NULL;

-- Add weight column to edges (default 1.0 preserves all existing queries)
ALTER TABLE mythic_edges
  ADD COLUMN IF NOT EXISTS weight FLOAT NOT NULL DEFAULT 1.0;

-- Materialized view stubs (created empty; filled on first cron refresh)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_artist_similarity_scores AS
  SELECT e.from_node_id AS artist_a, e.to_node_id AS artist_b,
         e.weight AS similarity_score, e.created_at
  FROM mythic_edges e WHERE e.edge_type = 'similar_artist' WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_mv_artist_sim
  ON mv_artist_similarity_scores (artist_a, artist_b);

-- Resolves: Phase 8 — polymorphic node refs + materialized views

COMMIT;
```

**Backfill strategy for `external_id`:** After deploying migration 067, run a one-time UPDATE:

```sql
UPDATE mythic_nodes n
SET external_table = 'profiles', external_id = p.id
FROM profiles p
WHERE n.node_type = 'artist_profile'
  AND n.external_id IS NULL
  AND (n.props->>'profile_id')::uuid = p.id;
-- Repeat for other node_types using their canonical props key
```
