# Spec: Mythic Strategic Agents + Gallery UI (Phase 6/7)

**Goal**: Make the four powerful Mythic strategic agents (Scene Orbit, Collab Weaver, Narrator, Yield Analyst) first-class, discoverable, and usable inside MIXHIVE, while clearly distinguishing them from user-editable Lua automation agents.

## Current State (as of this spec)
- User-facing Lua agents (Lupa runtime) live in `/agents` and the Gallery (`/agents/gallery`).
- Strategic agents (wasmoon runtime) already exist in `src/server/lua-agents/` (profile_coach, scene_radar, opportunity_match, etc.).
- We have just added the four Mythic personas as strategic agents:
  - `mythic_scene_orbit`
  - `mythic_collab_weaver`
  - `mythic_narrator`
  - `mythic_yield_analyst`

## Design Principles

1. **Strategic agents are "Mythic OS features"** — not user scripts. They are more powerful, have access to richer tools (LLM, vector, future Mythic graph queries), and are curated by MIXHIVE.
2. **Clear separation in UI**:
   - "My Agents" = user Lua automation (editable, social triggers).
   - "Mythic Agents" = strategic, graph-aware, pro-tier intelligence layer.
3. **Gallery is the discovery surface** for both, but with distinct sections.
4. **All output goes through the existing suggestion/approval pipeline** (no auto-actions for Mythic agents in Phase 6/7).

## Proposed Gallery Structure

### /agents/gallery

**Sections (in order):**

1. **Mythic Agents** (new prominent section at the top for Pro users)
   - 4 cards, one per persona
   - "Powered by MythicNode graph"
   - "Pro" badge
   - "Enable" or "Request Access" button (since they are system agents)
   - Clicking a card opens a beautiful detail modal with:
     - What the agent does
     - Example output
     - Trigger cadence (weekly / on demand)
     - Required permissions (read graph data, call LLM, etc.)

2. **Starter Library** (existing)
3. **Community Agents** (existing public agents)

When a user "enables" a Mythic agent, it registers them for that agent's runs (stored in a new `user_strategic_agents` or similar join table, or simply by checking tier + feature flag).

## Agent Detail Modal / Page

For each Mythic agent:

- Hero description (from registry)
- "How it uses your MythicNode graph" explanation
- Sample output (static for now, later live previews)
- "Last ran" + "Next scheduled"
- Toggle: "Receive proactive suggestions from this agent"
- Link to "View my quest / yield history" where relevant

## Implementation Notes for Codex

- Add the 4 agents to the wasmoon registry (done in this session).
- Expose new tool surface for Mythic graph queries once 046 worker matures (`mythic.graph.query`, `mythic.quest.get`, etc.).
- Create a small `user_mythic_agents` preference table or use existing feature flags.
- The Agents page (`Agents.tsx`) should show active strategic agents with a distinct "Mythic" visual treatment (gold/black accents).

## Success Metrics

- % of Pro users who enable at least 2 Mythic agents
- Acceptance rate of suggestions coming from Mythic agents vs regular agents
- Time-to-first-value (user sees a useful suggestion from a Mythic agent within 7 days of enabling)

## Open Questions

- Should Mythic agents be automatically enabled for all Pro users, or opt-in?
- Do we want a "Mythic Agent Inbox" that is separate from the regular Agent Inbox?

This spec should be turned into tickets after the core worker (046 + job processor) is productionized.