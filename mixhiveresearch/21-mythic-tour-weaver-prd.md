# PRD: Mythic Tour Weaver — Real Gig & Venue Logging (Experiment 5)

**"Turn every gig into a permanent, queryable chapter in your legend."**

**Status:** Draft — Ready for Codex + Claude Code implementation  
**Date:** Current  
**Governing:** `mixhiveresearch/19-mythicnode-differentiation-engineered-prompt.md` (Phase 6.5/7)  
**Related:**  
- `mixhiveresearch/20-mythic-differentiation-experiments.md` (Experiment 5)  
- `mixhiveresearch/17-mythic-graph-seeding-onboarding-prd.md` (direct predecessor / foundation)  
- `supabase/migrations/045_mythicnode_graph.sql` + 046 + 047  
- `src/components/GraphSeedingModal.tsx` (current non-functional stub)  
- Existing agents: `venue_fit.lua`, `booking_scout.lua`, `mythic_scene_orbit.lua`

---

## 1. Problem & Opportunity

The MythicNode graph is live (045–047). Strategic Lua agents (collab_weaver, yield_analyst, narrator, scene_orbit) are running. The GraphSeedingModal UI exists but is a pure simulation — it console.logs and shows fake success.

**Current reality:**
- Users have almost no `performed_at`, `booked_by`, or venue nodes.
- Agents have almost nothing high-signal to reason over for tours, scenes, or opportunities.
- The promise of "your career has a story the agents can navigate" feels hollow on first use.

**The Opportunity (highest-leverage single win available):**
Make logging a real gig *delightful, fast, and instantly valuable*. One well-designed flow that creates rich `performed_at` + venue + event nodes + edges will immediately power:
- Yield attribution (Experiment 2)
- Quest milestones
- Opportunity matching (Experiment 3)
- Future Mythic Co-Production and Tour Weaver agent behaviors
- "Your legend is growing" moments that make the entire Mythic system feel real.

This is the on-ramp that turns the graph from a research project into a living career operating system.

---

## 2. Goals

### Primary Goals
- Make it trivial and rewarding for a user to log 5–15 real `performed_at` edges in their first 10 minutes of meaningful interaction.
- Every logged gig must create high-quality, queryable nodes/edges (`venue`, `event`, `performed_at`, optionally `booked_by`).
- Instant, delightful feedback that shows the graph growing ("You just added 4 nodes and 3 edges to your legend").
- The data must be immediately usable by existing strategic agents (especially `scene_orbit`, `yield_analyst`, and the future Tour Weaver).

### Secondary Goals
- Establish the habit of logging real-world activity (gigs → collabs → outcomes).
- Provide clean data for future "Tour Weaver" agent that proposes next venues/promoters based on triangles.
- Make the "Legend" / venue history view on profiles feel rich and narrative even with modest data.

### Non-Goals (this PRD / first slice)
- Full calendar import (Google/RA) — future.
- Public verification or "claim gig" from promoters — future.
- Complete beautiful "Mythic Map" timeline visualization (we can start with a simple list + one strong profile surface).
- Full Tour Weaver agent behavior (we will sketch it; full implementation after the data exists).

---

## 3. Core User Flow: "Log a Gig → Grow Your Legend"

### 3.1 Entry Points (prioritized)
1. **Existing GraphSeedingModal** (highest priority — make the "Recent Gig" tab real first).
2. Post-mix publish or after a big night ("Log the gig you just played?").
3. Profile → "Your Venues & Legend" section → "Add a performance".
4. Agent suggestion ("Your Scene Orbit agent noticed you haven't logged any gigs in 90 days").

### 3.2 The Gig Logger (The Killer Micro-Experience)

**Form fields (refined from the stub):**
- Date (default last 18 months, easy picker)
- Venue / Event name (smart autocomplete from existing `mythic_nodes` of type `venue` + free text "Add new venue")
- City (pre-fill from venue if known)
- Role (Headline / Support / Resident / Radio / Festival / Other) — becomes `metadata.role`
- Co-billed / supported artists (tag input — creates `collab_with` edges when saved)
- Promoter / Booker (optional — creates `booked_by` edge to a `promoter` node)
- Link (optional — RA, Instagram, ticket, SoundCloud set)
- Notes / memory (optional, becomes part of narrative payload)

**On Save (atomic, fast feedback):**
1. Create or find `venue` node (owner_id = current artist or null for famous venues).
2. Create `event` node (title = venue + date + role, occurred_at = date).
3. Create `performed_at` edge (artist → event/venue) with rich metadata.
4. Optionally create `booked_by` edge if promoter entered.
5. Create lightweight `collab_with` edges for any co-billed artists mentioned.
6. Enqueue a lightweight `mythic_graph_job` for similarity/embedding derivation (following 046 pattern).
7. Return counts (`nodesCreated`, `edgesCreated`) + the new nodes for instant UI celebration.

**Instant feedback (critical for habit formation):**
- Hive / confetti micro-animation.
- "Beautiful — you just wrote this gig into your permanent legend. +4 nodes, +5 edges."
- "This will help your agents recommend better venues and collabs."
- Option to "Log another" or "View my growing map".

### 3.3 Ongoing / Habit Surface
- Small persistent "Log a gig" floating action or profile CTA.
- After a user logs 3+ gigs, surface a "Your Venues" or "Tour History" mini view (simple list is fine for v1).

---

## 4. MythicNode Graph Impact (Minimal & Powerful)

**Heavy reuse of existing schema (045):**
- `node_type` = `venue`, `event`
- `edge_type` = `performed_at`, `booked_by`, `collab_with`
- `payload` for role, notes, link, etc.
- `occurred_at` on both nodes and edges
- `metadata` on edges for role, promoter context, agent provenance later

**Very small potential additions (only if truly needed in 048):**
- A security-definer `log_performance(...)` RPC that does the atomic node+edge creation safely.
- Optional thin helper view or function for "recent performances for artist".

No new massive tables. We stay extremely close to the 045 design.

---

## 5. Codex Handoff (Infra / Schema / Jobs)

### 5.1 Migration 048 (to be produced as part of this work)
- Next number after 047 → `048_log_performance_and_venue_helpers.sql`
- Must be 100% compliant with `mixhive-migration` skill (idempotent, header, `begin/commit`, Resolves footer).
- Primary content: `log_performance` security-definer function (or RPC) that:
  - Takes structured input (artist_id, date, venue_name, city, role, co_billed[], promoter?, notes?, link?)
  - Idempotently creates/finds venue + event nodes
  - Creates the `performed_at` + optional `booked_by` + `collab_with` edges
  - Returns created node/edge counts + ids
- Any small supporting indexes or CHECK constraint relaxations if discovered during exploration.

### 5.2 Backend
- New (or extended) function in `database-queries.ts`: `log_performance(...)`
- New API route (protected): `POST /api/mythic/log-performance` (or reuse/extend existing mythic routes)
- Wire the existing `GraphSeedingModal` "Log & Seed Graph" button to call the real endpoint (currently the only real implementation task in the minimal slice).
- Enqueue derivation job via existing `mythic_graph_jobs` pattern.

### 5.3 RLS & Security
- The RPC must be security definer or carefully use service role internally.
- Strict ownership checks (only the artist or their agents can log on their behalf in this phase).
- All created nodes must have correct `owner_id`.

### 5.4 Lua Surface (minimal)
- No new public tools required for v1 of logging.
- Future Tour Weaver agent will read the new edges via existing `mythic.graph.query`.

---

## 6. Claude Code Handoff (UI / States / Copy)

**Immediate (minimal slice):**
- Make the "Recent Gig" tab in the existing `GraphSeedingModal` fully functional.
- Replace the `handleSubmitGig` simulation with a real call + proper loading / success / error states.
- Add the celebratory feedback UI (counts + short message) using existing design tokens.
- "Log another" flow that keeps the modal open with date pre-filled to the last entry.

**Later (still in scope of this PRD but after minimal slice):**
- Small "Your Venues & Legend" section on Profile (list of recent `performed_at` with venue names and dates).
- Empty states that drive back to the logger ("Your legend is still empty — log your last 3 gigs to unlock better agent recommendations").

**Copy tone examples:**
- "This gig just became part of your permanent myth."
- "Your agents now know you played Fuse as support in May."
- "Nice. That performance edge will help future versions of Scene Orbit and the Tour Weaver recommend the right rooms for you."

**Mobile:** The flow must feel excellent on 320–390px width (many DJs log on their phone after a gig).

---

## 7. Success Metrics (Lightweight but Powerful)

**Leading:**
- % of users who log ≥1 real gig within 7 days of seeing the modal.
- Average number of `performed_at` edges created per user in first 30 days.

**Lagging (the real proof):**
- Correlation between number of logged performances and downstream signals (agent suggestion acceptance, quest completion, opportunity applications, self-reported "this helped me understand my momentum").

**Qualitative:**
- "I finally feel like the system actually knows my real career instead of just my SoundCloud stats."

---

## 8. Minimal First Implementation Slice (Safe to Start Immediately After Approval)

**In scope for first real commit:**
- Migration 048 with the `log_performance` RPC (or equivalent helper).
- Backend function + API route.
- Wire the existing `GraphSeedingModal` "Recent Gig" tab to call it.
- Basic success feedback showing node/edge counts.
- RLS + ownership validation.
- Full verification gates (`tsc --noEmit`, build, manual RLS review).

**Explicitly out of scope for first slice:**
- New beautiful "Legend" profile section (simple list is fine later).
- Full Tour Weaver agent.
- Co-billed artist resolution or promoter nodes (can start with just venue + performed_at).
- Any changes to the other tabs in the modal.
- Mobile-optimized visual design beyond making the current form work.

This slice is small enough to be safe and fast, yet valuable enough to prove the entire Mythic graph concept to users.

---

## 9. Future Phases (Not in this PRD)

- Dedicated "Tour Weaver" strategic agent (proposes next 3 venues/promoters with evidence from triangles).
- Rich "Mythic Map" visualization of venue history.
- Outcome claiming flow ("This gig led to X opportunity" → `yielded_outcome` edge).
- Promoter/venue-side views (future, after artist side is solid).

---

**Resolves:** Phase 6.5/7 — Experiment 5 (highest-priority on-ramp for the entire Mythic system).

This PRD is intentionally narrow and deep. When implemented, it will be the moment the graph stops being infrastructure and starts being the thing users and agents actually live inside.