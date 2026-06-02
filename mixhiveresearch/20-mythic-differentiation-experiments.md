# MIXHIVE Mythic Differentiation Experiments — Detailed Specs (Phase 6.5 / 7)

**Status:** Ready for Codex + Claude Code implementation planning  
**Depends on:** 19-mythicnode-differentiation-engineered-prompt.md (the governing agent prompt), migrations 045–047, live mythic graph + job infrastructure, 4 strategic Lua agents, GraphSeedingModal (MVP), current `mythicTools` surface  
**Date:** Current (post live graph + agents)  
**Owner split:** Codex (infra, jobs, Lua tool surface, schema, RLS) • Claude Code (UI flows, states, integration, copy, agent gallery surfaces)

---

## Executive Summary

This document translates the high-level differentiation strategy from the Phase 6.5 engineered prompt into 5 concrete, implementable experiments. Each experiment is designed to exploit the **now-shipping** MythicNode graph (045–047), the derivation + job worker pattern, the wasmoon strategic Lua agents + minimal `mythicTools` surface, Supabase Realtime, and the existing suggestion/confirmation pipeline.

The goal is no longer to build the foundation — it is to make the foundation **visibly and undeniably powerful** for serious underground electronic DJs and producers, especially in the Belgian/Flemish scene around VI.BE.

All proposals strictly follow the constraints in the governing prompt:
- Modular monolith only
- Postgres + Redis + background workers (exact `mythic_graph_jobs` / `audio_jobs` pattern)
- Invoke `mixhive-migration` and `mixhive-lua-agent` skills for any changes
- Full RLS + service-role discipline
- Every agent action surfaces as editable suggestions with provenance (`recommended_by_agent` + `agent_id`)
- No new paid external APIs without overwhelming justification
- No external graph database

---

## Experiment 1: Mythic Co-Production Sessions (Real-Time Collab + Automatic Provenance)

### 1.1 Product Narrative & "Why Now / Why Us"
"Every meaningful collaboration should write itself into your legend."

In 2026, BandLab and Soundtrap own generic real-time browser collaboration. MIXHIVE can own **attributed, career-advancing, underground-electronic collaboration** for the exact creators who care about VI.BE calls, RA venues, and long-term scene capital.

A Mythic Session is not another DAW. It is a lightweight, graph-aware collaboration space where:
- Stems/assets live in Supabase Storage (private or shared via signed URLs)
- Presence, cursors, and chat run over Supabase Realtime
- Every save, fork, or "final export" automatically proposes `collab_with`, `inspired_by`, and `quest_milestone` edges
- The session can be claimed as a `mix` node that feeds the Yield Analyst and future Tour Weaver

**Uncopyable advantage:** Only MIXHIVE turns a 2-hour co-production session into durable, queryable career memory that later appears in "why this opportunity is perfect for you" explanations.

### 1.2 MythicNode Graph Usage (Minimal Deltas)
- **Reuse heavily:**
  - `collab_with` (artist ↔ artist via the session)
  - `inspired_by` (new but already in the 045 check constraint)
  - `quest_milestone`
  - `yielded_outcome` (later, when the resulting track leads to a booking)
- New lightweight concept: `collab_session` as a first-class entity (can be implemented as a special `mix` node with `payload.session = true` + a new edge type `participated_in_session` or simply use `collab_with` edges carrying `metadata.session_id`).

**Recommended minimal addition (if justified):**
- Add `'participated_in'` to the `mythic_edges.edge_type` check constraint (via new migration).
- Or keep it purely in `metadata` for v1 to avoid schema change.

### 1.3 Lua Agent Behaviors (Current Surface + Minimal Extension)
Use existing strategic agents + one new lightweight "Session Weaver" persona (wasmoon).

**Behaviors:**
- On session creation or manual "Invite agents": `mythic_collab_weaver` or new Session Weaver proposes 1–2 artists from current `scene_orbit` or high `performed_at` overlap who have complementary recent yield.
- On meaningful save/fork: propose 1–2 `collab_with` + `inspired_by` edges + a short quest milestone description.
- On "Export as Mix": offer to turn the session into a proper `mix` node + attach the resulting `collab_with` edges.

**Proposed minimal safe tool extension (only if needed):**
- `mythic.session.summarize(session_id)` — returns recent activity for LLM prompting (read-only).

All proposals go through the existing `suggestion(...)` + confirmation pipeline. No auto-edges.

### 1.4 Codex Handoff (Infra / Jobs / Tools)
- **No heavy new schema required for v1.** Use existing `mythic_nodes` + `mythic_edges` + `mixes` table + Storage buckets.
- Realtime: Design a dedicated channel pattern (`collab_session:{session_id}`) for presence + lightweight state (who is here, current stem list). Use Supabase Realtime Broadcast + Presence.
- Optional lightweight Yjs prototype (only for arrangement metadata if conflict resolution becomes painful — start without it).
- New or extended job type: `collab_session_post_process` (lightweight derivation of edges after session ends, following 046 pattern). Use the existing `MythicGraphProcessingWorker`.
- Storage: New private bucket or path prefix for session stems (`collab-sessions/{owner_id}/{session_id}/`).
- Tool surface: Add the one new read-only helper above if the Session Weaver needs it. Follow `mixhive-lua-agent` skill.
- API: New or extended route under `/api/mythic/session/*` (create, invite, export, claim-outcome) protected appropriately.

**Migration (if any):** Only if we decide `participated_in` edge type is worth adding (very small).

**RLS:** Session participants get temporary access via signed URLs + RLS policies on a new `collab_session_participants` table (or reuse existing patterns).

### 1.5 Claude Code Handoff (UI / States / Copy)
- New entry point: "Start Mythic Session" from profile, mix detail, or active quest.
- Session room UI (minimal viable):
  - Participant presence avatars (tied to mythic_nodes)
  - Stem / asset list with upload + drag-to-arrange (very lightweight, not full DAW)
  - Chat (Realtime)
  - Prominent "End Session & Review Legend Updates" button
- Post-session review modal: shows proposed edges + quest milestones with "Edit / Approve / Discard" (exactly like current agent suggestions).
- Copy tone: "This session just became part of your myth." / "Evidence for future agents and opportunities."

**Integration points:** Agent Gallery (new "Session Weaver" card), Quest detail view, Mix creation flow.

### 1.6 Success Metrics & Experiment Design
- Primary: % of Mythic Sessions that result in ≥1 new `collab_with` or `quest_milestone` edge within 24h.
- Secondary: Sessions that later produce a `yielded_outcome` (bookings, releases, strong VI.BE responses) within 90 days.
- Cohort: Users who completed ≥1 Mythic Session vs matched controls on opportunity application quality / success rate.
- Qualitative: "This made our actual gig feel like it was already written into the story."

---

## Experiment 2: Yield Attribution Dashboard + Career Narrator v2

### 2.1 Product Narrative
"Finally see which of your actions actually moved the needle — and let your agents narrate the story."

This directly realizes the vision in `18-mythic-metrics-dashboard-spec.md` now that the graph and `yielded_outcome` edges are live.

### 2.2 MythicNode Graph Usage
Heavy consumption of:
- `yielded_outcome` edges (with `metadata` containing outcome_type, value, linked opportunity/venue/etc.)
- Parent edges that led to those outcomes
- `recommended_by_agent` for explainability ("The Collab Weaver suggested this in March. You logged the outcome in June.")

New lightweight flow: "Claim this outcome" (manual + agent-assisted) that writes a `yielded_outcome` edge pointing back to the causal nodes.

### 2.3 Lua Agent Behaviors
- Expand `mythic_yield_analyst` (already exists) to power dashboard insights.
- Expand `mythic_narrator` to produce "Career Chapters" (e.g. "The Fuse Breakthrough Chapter — 3 performed_at edges + 1 high-yield collab in Q2 produced 2 follow-on bookings").
- Weekly strategy pass (on_schedule or manual) surfaces 2 "Double Down" patterns + 1 "Deprioritize" with evidence.

### 2.4 Codex Handoff
- Expand `mythic.yield.get_summary` (currently a placeholder) with real aggregations (top patterns by yield, momentum trends). Can be done in SQL + cached in Redis or materialized views.
- New RPC or helper: `claim_yield_outcome(artist_id, causal_edge_ids[], outcome_payload)`.
- Background job for periodic yield rollups (follow 046 pattern).
- Secure read paths for the dashboard (service role for agents, RLS for owner).

### 2.5 Claude Code Handoff
- Dashboard surface (per 18- spec, updated for live schema).
- Narrative "Chapter" cards powered by the narrator agent (beautiful, shareable, press-kit friendly).
- "Claim Outcome" flow (simple form + graph evidence picker).
- Integration into Profile, Quests, and Agent Gallery.

### 2.6 Success Metrics
- % of active users who have claimed ≥1 outcome in first 60 days.
- Correlation between claimed outcomes and future opportunity success rate.
- Agent suggestion acceptance rate → measured downstream yield lift (the core learning loop for the entire Mythic system).

---

## Experiment 3: VI.BE Opportunity Intelligence + Agent-Assisted Applications

### 3.1 Product Narrative
"VI.BE calls are the best opportunities in Belgium. MIXHIVE makes you the smartest applicant."

### 3.2 MythicNode Graph + Lua
- Treat high-value VI.BE calls as `opportunity` nodes (lightweight import or manual "add this call").
- On application: rich `submitted_to` edge carrying the artist's current momentum (recent `performed_at`, active quests, high-yield patterns from the Yield Analyst).
- Agent ("Opportunity Scout" or extension of existing agents) proposes best-fit calls + contextualized draft text that references real graph evidence.

### 3.3 Codex Handoff (Careful Scope)
- Lightweight ingestion path for VI.BE calls (start manual / copy-paste + later official integration). Do **not** scrape.
- New helper: `mythic.opportunity.relevant(profile_id)` using existing graph queries + opportunity table.
- RLS: Artists only see their own application graph.

### 3.4 Claude Code Handoff
- "Opportunities" tab or widget that ranks VI.BE calls with "Why you (graph evidence)".
- Application composer pre-filled with live graph context (editable).
- Post-application tracking that feeds Experiment 2 dashboard.

### 3.5 Success Metrics
- Application volume + self-reported success rate lift vs baseline.
- % of applications that include MythicNode-derived context (proxy for higher quality).

---

## Experiment 4: Refined Lua-Powered Discovery & Scene Navigator

### 4.1 Narrative
"Your agents don't just welcome followers — they help you navigate the actual scene graph."

### 4.2 Graph + Lua
- Build on `mythic_scene_orbit` + new lightweight Discovery helpers.
- Safe read-only tools: `find_similar_artists_by_venue_triangle`, `venues_giving_traction_to_my_cohort`.
- All output as suggestions with full provenance.

### 4.3 Codex
- Minor expansions to `mythic.graph.query` surface or new thin RPCs (indexed, read-only, RLS-respecting).
- Pre-computation jobs for hot "scene orbit" data (cached).

### 4.4 Claude Code
- "Mythic Radar" widget in feed or dedicated Discovery surface.
- "Add to my quests" one-click from agent suggestions.

### 4.5 Metrics
Discovery engagement + downstream follow-through to real collabs or opportunities.

---

## Experiment 5: Mythic Tour Weaver + Artist-Venue Graph Activation

### 5.1 Narrative
"Your gigs stop being isolated dots. They become chapters you (and your agents) can actually use."

### 5.2 Graph
- Make logging a gig (`performed_at` + `booked_by` + venue/promoter nodes) extremely easy (mobile-first flow building on GraphSeedingModal).
- "Tour leg" as query + quest linkage over time-bounded `performed_at` edges.
- Agent proposes next logical venues based on shared successful artists.

### 5.3 Codex
- Extremely simple, high-conversion "I played here" flow that writes the edges (this is the highest-leverage small win in the entire program).
- Optional small migration for tour grouping if queries get painful.

### 5.4 Claude Code
- Beautiful "Mythic Map" / timeline view of venue history.
- Outreach draft generator that pulls exact graph evidence.
- Post-gig prompt: "Log this as part of your legend?"

### 5.5 Metrics
- % of logged gigs that later correlate with new opportunities.
- Agent-driven outreach → booking conversion lift.

---

## Shared Technical & Process Guardrails (Apply to All 5)

- **Skills:** Any schema change → invoke mixhive-migration skill. Any Lua/tool change → invoke mixhive-lua-agent skill.
- **Job pattern:** Every new background derivation uses the existing `mythic_graph_jobs` + `MythicGraphProcessingWorker` pattern.
- **Suggestion pipeline:** All agent output goes through the existing confirmation/editing flow. No auto-mutations on user-visible state.
- **Provenance:** Every `recommended_by_agent` or auto-proposed edge must carry `metadata.agent_id` + `source_event`.
- **Verification before any PR:** `npx tsc --noEmit`, `npm run build`, relevant smoke tests, manual review of RLS.

---

## Recommended Implementation Sequencing (for Codex + Claude Code Planning)

**Phase A (Foundation for everything else)**
- Finish wiring GraphSeedingModal → real `logPerformance` / edge creation (high leverage, unblocks all agents).
- Expand `mythic.yield.get_summary` + `claim_yield_outcome` (Experiment 2 early).

**Phase B (High-visibility wins)**
- Experiment 5 (Tour Weaver / easy gig logging) — biggest "the graph is real" moment for users.
- Experiment 1 MVP (Mythic Sessions) — the most unique product surface.

**Phase C**
- Experiment 3 (VI.BE intelligence) — strongest geographic moat.
- Experiment 2 full dashboard + narrator chapters.
- Experiment 4 (Discovery polish).

**Phase D**
- Cross-experiment measurement loop (the real power of having the graph as the source of truth).

---

## Completion Criteria for This Document

This set of experiments is considered ready for implementation when:
- Every experiment has clear, minimal graph usage + realistic Lua behaviors on the *current* tool surface.
- Codex and Claude Code handoffs are specific enough to start work without major re-design.
- All proposals respect the constraints in the 19- governing prompt.
- Success metrics are defined and tied back to attributable `yielded_outcome` creation and downstream career lift.
- The "uncopyable" argument for each experiment is explicit and grounded in what competitors actually have in 2026 (BandLab/Soundtrap real-time, Venice/MNRGS/SymphonyOS/Viberate career tools, Spotify listener AI, raw VI.BE data).

---

**Next step:** Codex + Claude Code (or the next agent session) should pick 1–2 experiments from the sequencing above and produce the first implementation tickets / detailed component specs.

The foundation is live. These experiments are how we make it *unignorable*.

**End of document.**