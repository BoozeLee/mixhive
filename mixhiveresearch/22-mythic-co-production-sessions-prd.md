# PRD: Mythic Co-Production Sessions — Real-Time Collab + Automatic Provenance (Experiment 1)

**"Every meaningful collaboration should write itself into your legend."**

**Status:** Draft — Ready for Codex + Claude Code implementation planning  
**Date:** Current  
**Governing:** `mixhiveresearch/19-mythicnode-differentiation-engineered-prompt.md` (Phase 6.5/7)  
**Related:**  
- `mixhiveresearch/20-mythic-differentiation-experiments.md` (Experiment 1)  
- `mixhiveresearch/21-mythic-tour-weaver-prd.md` (sibling experiment)  
- `supabase/migrations/045_mythicnode_graph.sql` (core graph)  
- Existing Realtime usage in notifications/feed

---

## 1. Problem & Opportunity

In 2026, BandLab and Soundtrap deliver excellent generic real-time browser collaboration. They solve "multiple people editing audio together."

They do **not** solve the problem that actually matters to serious underground DJs and producers:

> "How does this 3-hour session with two other artists advance my career, get remembered by my agents, show up in my yield attribution, and help me get the next booking?"

**Current gap:** All existing collab tools treat the session as a disposable project file. When the session ends, the only artifact is a bunch of stems in a folder. There is zero provenance linking the creative act to real-world outcomes (gigs, label interest, future collabs).

**MIXHIVE's unique opening:**
We already have the live MythicNode graph (045–047), the job derivation pattern, strategic Lua agents, and the suggestion/confirmation pipeline. We can make every meaningful co-production session a first-class node in the artist's legend.

A **Mythic Co-Production Session** is a lightweight, graph-aware collaboration space where:
- Stems live in Supabase Storage
- Presence + chat run over Supabase Realtime
- Every save, fork, or export automatically proposes `collab_with`, `inspired_by`, and `quest_milestone` edges
- The session can later be claimed as a `mix` node that feeds Yield, Quests, and Opportunity intelligence

This is extremely hard for BandLab, Soundtrap, or Splice to copy without rebuilding the entire MythicNode + Lua agent stack.

---

## 2. Goals

### Primary Goals
- Allow two or more MIXHIVE artists to start a "Mythic Session" from their profiles, mixes, or active quests.
- During the session, automatically surface (via the existing suggestion pipeline) meaningful graph edges that should be written.
- When the session ends, give participants a clean review screen to approve/reject the proposed edges and quest milestones.
- The resulting data must immediately be usable by the Yield Analyst, Scene Orbit, and future Tour Weaver agents.

### Secondary Goals
- Make the experience feel premium and "cyber-hive" without competing on full DAW features.
- Create a new high-signal data source for the graph (sessions that actually happened and produced edges).
- Differentiate MIXHIVE as the place where collaboration has memory and career consequences.

### Non-Goals (MVP / first two slices)
- Building a full-featured browser DAW (we are not competing with Ableton or even BandLab's editor).
- Zero-latency live jamming with synchronized transport (this can come much later, if ever).
- Real-time MIDI/automation editing with Yjs (start with asset sharing + lightweight arrangement state only).
- Cross-platform mobile collab in v1.

---

## 3. Core User Flow

### 3.1 Starting a Session
Entry points:
- Profile → "Start Mythic Session"
- Mix detail page → "Start collab session around this mix"
- Active Quest → "Start session toward this milestone"
- Agent suggestion (e.g., Collab Weaver proposes two artists + "Start Mythic Session with them")

Flow:
1. User selects 1–3 other MIXHIVE artists (search + recent collaborators from graph).
2. Gives the session a working title and optional description.
3. Chooses privacy (private to participants vs. visible in legends later).
4. System creates the session record + Realtime channel.
5. All invited participants receive a notification + deep link.

### 3.2 Inside the Session Room (Minimal Viable)
- Participant presence (avatars + "X is here", using Supabase Realtime Presence).
- Simple stem / asset list:
  - Upload stems to the session's Storage path.
  - Basic drag-to-order (very lightweight arrangement).
- Text chat (Realtime Broadcast).
- "Propose edge" button (manual) or automatic prompts from the Session Weaver agent.
- Big prominent action: **"End Session & Review Legend Updates"**.

### 3.3 Ending the Session — The Magic Moment
When any participant ends the session:
- The system runs a lightweight post-process job (following the 046 pattern).
- It proposes:
  - `collab_with` edges between participants
  - `inspired_by` edges (if stems were shared)
  - `quest_milestone` entries if the session was tied to an active quest
- All participants land on a **Review & Approve** screen (exactly like current agent suggestion flows).
- Approved edges are written with proper `recommended_by_agent` or `source_event = 'mythic_session:xxx'` provenance.
- The session can optionally be exported/claimed as a `mix` node.

This is the moment that makes MIXHIVE different: the creative act becomes durable career memory.

---

## 4. MythicNode Graph Usage (Minimal Deltas)

**Reuse heavily (from 045):**
- `collab_with`
- `inspired_by` (already allowed in the check constraint)
- `quest_milestone`
- `yielded_outcome` (later)

**Recommended minimal addition (via 049 migration if justified):**
- Add `'participated_in'` to the `mythic_edges.edge_type` check constraint, or simply use rich `metadata.session_id` on `collab_with` edges for v1 (strongly preferred to keep schema changes tiny).

A `collab_session` can be represented initially as:
- A row in `mixes` with `payload.is_mythic_session = true` + `payload.session_participants = [...]`, or
- A lightweight new table `collab_sessions` (only if the mixes table feels too polluted).

Recommendation for MVP: Start with the `mixes` table extension + `metadata` on edges. Only introduce a dedicated table if usage patterns demand it.

---

## 5. Codex Handoff (Infra / Jobs / Tools)

### Schema (very light)
- Small migration (049) only if we decide to add the `'participated_in'` edge type.
- New or extended `collab_sessions` concept (start by extending `mixes`).

### Jobs
- New job type: `collab_session_post_process` (lightweight, enqueued on session end).
- Reuses the exact `MythicGraphProcessingWorker` pattern from `mythic-graph-processing.ts`.

### Realtime
- Dedicated channel pattern: `mythic_session:{session_id}` using Supabase Realtime Broadcast + Presence.
- Simple payload for presence, chat messages, and stem list updates.

### Storage
- New path convention: `collab-sessions/{session_id}/` (private bucket with signed URL sharing for participants).

### API
- New routes under `/api/mythic/sessions/*`:
  - `POST /create`
  - `POST /:id/invite`
  - `POST /:id/end` (triggers review flow)
  - `GET /:id` + presence

### Lua Tool Surface (minimal)
- One new read-only tool if needed: `mythic.session.summarize(session_id)`
- Follow `mixhive-lua-agent` skill strictly.

### RLS
- Session participants get temporary access via signed URLs + RLS policies on a `collab_session_participants` join table (or equivalent).

---

## 6. Claude Code Handoff (UI / States / Copy)

**Core surfaces needed:**
- "Start Mythic Session" flow (modal or dedicated screen) with artist multi-select.
- Session room (minimal viable):
  - Top bar with session title + participants + presence avatars.
  - Stem/asset panel (upload + basic ordering).
  - Chat panel.
  - "End & Review" primary action.
- Post-session review screen (reuses existing suggestion card patterns heavily):
  - List of proposed `collab_with` / `inspired_by` / `quest_milestone` items.
  - "Edit / Approve / Discard" per item.
  - "Claim as Mix" option.

**Copy tone:**
- "This session just became part of your myth."
- "The edges you approve here will power your agents' future recommendations."
- "Evidence for the Yield Analyst and future opportunities."

**Integration points:**
- Agent Gallery → new "Session Weaver" card.
- Quest detail view.
- Mix creation flow ("Export from Mythic Session").

---

## 7. Success Metrics

- Primary: % of Mythic Sessions that result in ≥1 approved `collab_with` or `quest_milestone` edge within 24 hours.
- Secondary: Sessions that later correlate with `yielded_outcome` edges (bookings, releases, strong VI.BE responses) within 90 days.
- Cohort comparison vs users who only use generic collab tools.
- Qualitative signal: "This made our session feel like it actually mattered to our careers."

---

## 8. Recommended Sequencing (for Experiment 1)

**Slice 1 (Safest starting point — similar to Exp 5's 21a slice):**
- Data model decision + tiny migration (if any).
- Basic `create session` + `end session` API + job.
- Very thin session room shell (presence + chat + stem list, no real audio editing).
- Post-session review screen wired to the suggestion pipeline.

**Slice 2:**
- Real asset upload + sharing via Storage + signed URLs.
- Lightweight arrangement state (drag order persisted via Realtime).
- Session Weaver agent integration.

**Slice 3:**
- "Claim as Mix" flow.
- Richer provenance and yield linkage.
- Polish + mobile experience.

---

## 9. Risks & Mitigations

- **Risk:** Scope creep into building a real DAW.  
  **Mitigation:** Ruthlessly limit UI to "asset sharing + light arrangement + chat + graph edge proposal." No transport sync, no plugin hosting, no MIDI in Slice 1–2.

- **Risk:** Realtime complexity.  
  **Mitigation:** Start with Supabase Realtime only. Introduce Yjs/CRDT only if conflict resolution on arrangement state becomes painful (and only for metadata, never raw audio).

- **Risk:** Low adoption because "it's not a real DAW."  
  **Mitigation:** Position explicitly as "the collaboration layer that remembers" on top of (or alongside) BandLab/Soundtrap. Many users will still do the heavy lifting elsewhere and only use Mythic Sessions for the memory/provenance layer.

---

**Resolves:** Phase 6.5/7 — Experiment 1 (the most visibly unique product surface in the entire Mythic differentiation program).

This PRD is intentionally scoped to stay true to MIXHIVE's strengths (graph + agents + provenance) rather than trying to win on audio editing features. When executed well, it will be one of the clearest demonstrations that MIXHIVE is not "another music social network."