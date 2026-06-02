# Mythic Agent Examples (Phase 6)

These are reference implementations of the four core "Mythic" strategic agent personas described in the Phase 6 research (docs 11–14).

They are written for the existing MIXHIVE Lua runtime (Lupa + wasmoon) and deliberately stay within the **proposal-only** safety model.

## The Four Personas

| File | Persona | Primary Feature | Trigger Style |
|------|---------|------------------|---------------|
| `01-scene-orbit-agent.lua` | Strategic Scene Navigator | Mythic Quest Lines | Weekly `on_schedule` + manual |
| `02-collab-weaver.lua` | Relationship Alchemist | Agent-Curated Collab Web | Weekly + after high-engagement events |
| `03-mythic-narrator.lua` | Career Archivist / AI DJ | Career-Level Narrative | Manual summon + occasional proactive chapters |
| `04-yield-attribution-agent.lua` | Career Scientist | Opportunity & Action Attribution | Weekly yield review |

## Usage

1. Copy the relevant file(s) into the agent's Lua editor in the MIXHIVE UI.
2. Customize the constants at the top (`SCENE_TAGS`, radius, quest title, etc.).
3. For production strategic agents, these will eventually live in the wasmoon strategic runtime (MIXHIVE-owned) rather than pure user agents, giving them slightly richer read access to aggregated signals while still respecting RLS.

## Key Constraints (Do Not Violate)

- Never call `mh.follow`, `mh.post_buzz`, `mh.comment`, etc. without going through `mh.propose_action` + explicit user approval.
- All graph queries must go through the approved `mh.query_mythic_graph` / `mh.get_*` surface (once implemented).
- Always include provenance / rationale when proposing anything.

## Next Steps (for Codex + Claude Code)

- Wire the new `mh.*` functions defined in doc 13 (`query_mythic_graph`, `find_collab_triangles`, `get_yield_summary`, `propose_collab_mission`, etc.).
- Add a first-class "Mythic Agents" gallery / templates section in the UI that can load these examples.
- Strategic (wasmoon) versions of these four will become the default "smart" agents new users get.

These examples are intentionally opinionated and grounded in the actual graph model rather than generic AI advice. They are meant to be forked and evolved by power users.

See `docs/LUA_AGENTS.md` for the base runtime contract and `mixhiveresearch/12-mythicnode-feature-specs.md` + `13-*.md` for the full design.

## Current Implementation Status (as of 046)

- Tables + RLS: `045_mythicnode_graph.sql`
- Job queue + derivation triggers: `046_mythicnode_derivation_and_jobs.sql`
- TypeScript job helpers: `src/lib/database-queries.ts` (enqueue_mythic_graph_job, mark_*, get_pending_*)

The foundation for automatic graph population is now in the database. The next major piece is the worker implementation that can process the new job types.