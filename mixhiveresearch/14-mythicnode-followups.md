# MIXHIVE MythicNode — Phase 6 Follow-up Answers

**Date:** 28 May 2026

This document directly answers the specific architectural and design questions raised at the end of the Phase 6 agent prompt.

---

## 1. Architectural Requirements for Implementing MythicNode Graph Storage

**Constraint (from 10-social-platform-scale-architecture.md):** Stay a modular monolith. Postgres is the system of record. Redis for cache/coordination. Background workers for heavy work. Defer external graph DB.

### Recommended Architecture (Phase 6)

- **Storage:** Two new tables (`mythic_nodes`, `mythic_edges`) + supporting quest tables as specified in 13-mythicnode-graph-and-agent-api.md.
- **Materialization:** Hybrid approach
  - **Strong triggers** for high-signal events (mix publish → node+edges, opportunity save → submitted_to edge, follow → followed edge).
  - **Background workers** (following the exact `audio_jobs` pattern from migration 040) for:
    - Embedding generation / refresh (pgvector)
    - Similarity edge derivation (collab_with via shared listeners + genre overlap)
    - Multi-hop / triangle pre-computation for hot users
    - Quest momentum recalculation
- **Query Layer:**
  - Small set of Postgres functions / Supabase RPCs (`get_mythic_ego_graph`, `find_collab_triangles`, etc.).
  - Redis caching for per-user ego graphs (invalidate on meaningful edge writes).
- **Derivation Traceability:** Every edge carries `source_event` and optional `metadata.agent_id`. This is critical for "Why did the agent recommend this?"
- **Future Migration Path:** The `mythic_nodes` / `mythic_edges` schema is deliberately portable. If/when traversals become the bottleneck (Phase 8+), the data can be projected into Neo4j or Kuzu without changing product logic.

**Avoid in Phase 6:**
- Custom graph query language.
- Heavy recursive CTEs on every request (pre-materialize hot paths).
- Any service boundary around the graph.

---

## 2. How to Design Lua-Based User Agent Behaviors for Music Discovery

### Current State (Excellent Foundation)
MIXHIVE already has two Lua runtimes:
- User automation (Lupa / Python on Vercel) — safe social reactions.
- Strategic AI agents (wasmoon) — for MIXHIVE-owned higher-intelligence agents.

### Recommended Design Principles for Discovery Agents

**Principle A — Discovery agents are "Scene Radar + Matchmaker", not "Playlist Generator"**

Good discovery in MIXHIVE context means:
- "Artists whose *trajectories* overlap mine in meaningful ways"
- "Venues and promoters currently amplifying voices at my exact career stage + genre + geography"
- "Micro-scenes that are heating up based on real booking + engagement patterns"

**Principle B — Use the MythicNode graph as the primary signal source**

A good discovery Lua behavior should primarily call the new graph functions (`query_mythic_graph`, `get_similar_artists_in_scene`, etc.) rather than raw `get_recent_mixes`.

**Principle C — Output is always proposals + context, never autonomous follows/likes**

Example healthy discovery agent behavior:

```lua
-- "Scene Radar" strategic agent (wasmoon, owned or user-forkable)
function on_schedule(event)
  local graph = mh.query_mythic_graph({
    center = mh.owner_id,
    node_types = {"artist_profile", "venue"},
    edge_types = {"performed_at", "engaged_with", "collab_with"},
    max_hops = 2,
    window_days = 120,
    within_km = mh.get_artist_goals().travel_radius_km or 150
  })

  local candidates = mh.get_similar_artists_in_scene(mh.owner_id, {"techno", "leftfield"}, 80, 12)

  for _, c in ipairs(candidates) do
    if not already_following(c) and c.shared_signals > 3 then
      mh.propose_action("follow_suggestion", c.node_id, build_rationale(c, graph))
      -- Creates a beautiful card: "3 artists you both have engaged with recently also follow them"
    end
  end
end
```

**Anti-patterns to ban in discovery agents:**
- Blindly liking or reposting content from discovered artists (reputation damage risk).
- Following large numbers of people without user confirmation.
- Using external platform data (no Instagram scraping).

---

## 3. Defining Success Metrics for MIXHIVE Social Feature Experiments

From 11- and 13- we already have a strong starting set. Here is the prioritized, instrumentable list for Phase 6 experiments:

### Tier 1 — Leading Indicators (weekly review)

- Graph density per active user (meaningful edges: `performed_at`, `submitted_to`, `collab_with`, `yielded_outcome`)
- Strategic Mythic Agent activation rate (% of users with ≥1 non-social-automation agent)
- Proposal acceptance rate (Accept/Edit vs Dismiss) broken down by agent persona
- Quest creation → first milestone completion time

### Tier 2 — Lagging / Outcome Indicators (monthly+)

- **Attribution yield:** % of `yielded_outcome` edges that trace back to at least one agent proposal or quest milestone
- **Opportunity conversion:** (Applications that became confirmed bookings or positive responses) / (opportunities that were both surfaced by a Mythic Agent *and* had user engagement)
- **Narrative reuse:** Number of Legend Card exports or "Copy career narrative" actions per week
- **Retention correlation:** 30/60/90-day retention for users who have an active quest vs. matched cohort without

### Tier 3 — Defensive / Health Metrics

- Agent error rate and auto-disable rate (must stay very low — trust is fragile)
- Graph query latency p95 (must not regress core feed / profile performance)
- Spam / low-quality proposal reports from users

**Instrumentation note:** Every proposal, acceptance, quest event, and manual "log outcome" should create a row that can be joined back to the specific `mythic_edge` and `lua_agent_run`. This is how we close the loop.

---

## 4. Integration Strategies for Real-Time Collaborative Music Editing

**Positioning (important):** MIXHIVE should **not** try to become a real-time collaborative DAW or stem editor in Phase 6–7. That is a different product category with brutal technical requirements (low-latency audio, conflict resolution, DAW plugin ecosystems).

### Recommended Strategy

1. **Complement, don't compete** with Splice Create/Stacks, Pibox, Soundtrap, BandLab, etc.
2. **Become the reputation + opportunity layer around collaboration.**
   - When a collab project reaches a meaningful state (first shared demo, first public mix, first gig from the collab), the user (or an agent) can create a `collab_with` edge + `remixed` or `yielded_outcome` nodes.
   - The Mythic Agent can then reason over "your most successful collabs historically came from X pattern" and surface new targets.
3. **Lightweight integration points (future, not Phase 6):**
   - "Export stems to Splice/Create link" button that also creates a private `collab_thread` node in MIXHIVE.
   - On mix publish that has `collab_with` metadata → automatically surface the collab in both artists' Mythic graphs.
   - Timestamped feedback import (if a partner platform exposes an API) → `engaged_with` edges with richer metadata.

**Phase 6 stance:** Treat any real-time collab editing as an external tool. MIXHIVE's job is to make the *outcomes* of those collaborations visible, attributable, and agent-actionable in the career graph.

---

## 5. Mapping Artist-to-Venue Graph Relationships in MythicNode

This is one of the highest-leverage parts of the entire MythicNode concept.

### Current Gap
Today MIXHIVE has almost no structured memory of "which artists played which rooms and what happened afterward."

### Recommended First-Pass Mapping (Phase 6)

**Node creation:**
- `venue` nodes (start with manual seed for key Belgian rooms + user-generated stubs when someone logs a gig at a new place).
- `event` nodes (lighter than full calendar events — just "performance occurrence").

**Primary edges:**
- `performed_at` (artist_profile → event or directly → venue, with `metadata.role`, `date`, `set_length_minutes`, `billed_with[]`)
- `booked_by` (artist or event → promoter / venue / curator node)

**How the graph gets populated in practice:**
- **Manual (MVP):** "Log a Gig" flow in profile/dashboard (very high signal, low volume at first).
- **Agent-assisted:** User pastes a RA link or writes "Played at Fuse with X on May 17" → agent parses + proposes the edge.
- **Opportunity closure:** When an `opportunity` of type `gig` moves from "applied" → "booked" (future status), auto-create `performed_at` + `booked_by` edges.
- **Future:** Light ingestion from public RA / venue calendars (with strong user confirmation).

**Power this unlocks (examples):**
- "Show me all venues where artists similar to me (shared listener overlap + genre) have played in the last year, sorted by how many of them got re-booked."
- Agent proposal: "Three artists in your exact 90-day momentum band got their first Kiosk session after playing [specific smaller room] twice. You have one upcoming date that fits the pattern."
- Yield analysis: "Your conversion from first play at a room → re-booking is 2.8x higher when you post a 60-second IG story + a full mix within 5 days."

**Data quality note:** Venue normalization is hard (many names, spellings, "Fuse Brussels" vs "Fuse"). Start with a small curated list + fuzzy matching + user correction UI.

---

## Summary Recommendation

All five follow-up areas are solvable within the modular monolith + Postgres + existing Lua runtime constraints. The unifying theme is:

> **Make the graph the source of truth for career memory, and make the (safe, proposal-only) agents the primary way creators interrogate and act on that memory.**

This is the part that is genuinely difficult for every listed competitor to replicate quickly.

---

**End of Phase 6 core research package (11–14).** Ready for Codex implementation planning and Claude Code UI flows.