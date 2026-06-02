# Ready to Implement — Checklist & Ticket Breakdown

**Experiments:** Tour Weaver (Exp 5) + Co-Production Sessions (Exp 1)  
**Date:** Current  
**Governing Documents:** 19- (engineered prompt), 20- (master spec), 21- (Tour Weaver PRD), 22- (Co-Production PRD)

---

## Overall Philosophy

- We build the **smallest possible valuable vertical slices**.
- Every slice must be reviewable and shippable.
- Every schema change goes through the `mixhive-migration` skill.
- Every Lua/tool change goes through the `mixhive-lua-agent` skill.
- No production code is committed until the user explicitly approves the slice.
- Verification gates are mandatory: `npx tsc --noEmit` + `npm run build`.

---

## Priority Order (Recommended)

1. **Experiment 5 – Tour Weaver (Highest immediate leverage)**
   - Makes the graph feel real to users fastest.
   - Feeds every other experiment and agent.

2. **Experiment 1 – Co-Production Sessions (Highest differentiation)**
   - The most unique product surface.
   - Can run in parallel once Exp 5 has basic data flowing.

---

## Experiment 5: Tour Weaver / Real Gig Logging

### Slice 5.1 — "Make GraphSeedingModal Real" (Minimal Safe First Slice)

**Goal:** Turn the existing stub into a working flow that creates real `performed_at` + venue data.

**Tickets / Tasks:**

- **T5.1.1** — Review + apply (or refine) migration `048_log_performance_rpc.sql`
- **T5.1.2** — Implement `logPerformance(...)` helper in `src/lib/database-queries.ts`
- **T5.1.3** — Create protected API route `POST /api/mythic/log-performance` (or extend existing mythic routes)
- **T5.1.4** — Wire the "Recent Gig" tab in `GraphSeedingModal.tsx` to the real API (replace simulation)
- **T5.1.5** — Add proper loading / success / error states + celebratory feedback showing real node/edge counts
- **T5.1.6** — Add "Log another" flow that keeps the modal open
- **T5.1.7** — Full verification: `tsc --noEmit`, build, manual RLS + ownership testing
- **T5.1.8** — Update any relevant docs (21a slice definition can be marked complete)

**Definition of Done for 5.1:**
A user can log a real gig through the existing modal and see the nodes/edges appear in the database + receive good feedback. No other tabs or big UI changes.

**Owner split:**
- Codex: T5.1.1 – T5.1.3 + RLS review
- Claude Code: T5.1.4 – T5.1.6 + states/feedback

**Risk level:** Low (builds directly on existing stub + proven job pattern).

---

### Slice 5.2 — "Legend Surface + Habit Formation" (Next)

- Small "Your Venues & Legend" section on Profile (list of recent performances).
- Persistent "Log a gig" entry point from dashboard/profile.
- Basic "Tour History" view (simple list is enough).
- Agent suggestions that reference newly logged gigs.

---

## Experiment 1: Mythic Co-Production Sessions

### Slice 1.1 — "Session Foundation + Minimal Room" (Safest starting slice)

**Goal:** Allow users to create a session, see presence + chat, and reach a post-session review screen that proposes edges.

**Tickets / Tasks:**

- **T1.1.1** — Data model decision (extend `mixes` table vs new lightweight `collab_sessions` table). Document decision.
- **T1.1.2** — Small migration (049?) if we add `'participated_in'` edge type or supporting tables (follow `mixhive-migration` skill).
- **T1.1.3** — Implement core session creation + participant logic (new or extended functions in `database-queries.ts`).
- **T1.1.4** — Create API routes under `/api/mythic/sessions`:
  - `POST /create`
  - `POST /:id/invite`
  - `POST /:id/end`
  - `GET /:id`
- **T1.1.5** — Create Realtime channel pattern (`mythic_session:{id}`) for presence + basic chat.
- **T1.1.6** — Create component stub `src/components/MythicSessionRoom.tsx` with:
  - Session header + participant presence avatars
  - Basic stem/asset list (upload + drag order using existing patterns)
  - Chat panel
  - "End Session & Review" button
- **T1.1.7** — Post-session review screen (reuse existing suggestion/approval patterns heavily) that proposes `collab_with` + `inspired_by` edges.
- **T1.1.8** — Basic job skeleton: `collab_session_post_process` (following 046 pattern) that generates the proposed edges.
- **T1.1.9** — Full verification gates + RLS review for session access.
- **T1.1.10** — Entry point wiring ("Start Mythic Session" from profile or mix detail — can be very thin).

**Definition of Done for 1.1:**
Two users can create a session, see each other online, chat, upload a couple of stems, end the session, and approve/reject proposed graph edges. No real audio playback/editing required.

**Owner split:**
- Codex: Data model, migration (if any), queries, API routes, job skeleton, Realtime setup, RLS.
- Claude Code: Session room UI shell, post-session review UI, entry points, copy.

**Risk level:** Medium (Realtime + new domain). Keep extremely scoped.

---

### Slice 1.2 — "Asset Sharing + Session Weaver Agent"

- Proper Storage integration for session stems + signed URL sharing.
- Lightweight persisted arrangement state.
- Integration of a "Session Weaver" strategic agent (proposes edges during or at end of session).
- Better invite flow + notifications.

---

### Slice 1.3 — "Claim as Mix + Yield Linkage"

- "Export / Claim this session as a Mix" flow.
- Stronger linkage to `yielded_outcome` edges later.
- Polish and mobile experience.

---

## Cross-Experiment / Platform Tickets

- **T0.1** — Decide and document final representation for "sessions" (mixes extension vs dedicated table) — affects both experiments indirectly.
- **T0.2** — Add any small shared TypeScript types for Mythic sessions / performances (can be done early).
- **T0.3** — Update Agent Gallery to surface new "Session Weaver" and "Tour Weaver" cards (after core slices land).
- **T0.4** — Basic analytics instrumentation for session creation and edge approval rates (feeds success metrics for both experiments).

---

## Recommended First Two PRs (After This Document Is Reviewed)

**PR A (Experiment 5 focus):**
- 048 migration (refined if needed)
- `logPerformance` helper + API route
- GraphSeedingModal wiring + feedback states
- (This is the highest-leverage single PR we can ship right now)

**PR B (Experiment 1 foundation):**
- Session data model decision + any 049 migration
- Core session creation + Realtime setup
- Minimal `MythicSessionRoom` stub + post-session review
- Basic API routes

These two PRs can be developed somewhat in parallel once the data model decisions are locked.

---

## Verification Checklist (Before Any PR Is Considered Complete)

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] Relevant smoke tests (if they cover the area)
- [ ] Manual RLS + ownership testing
- [ ] The `mixhive-migration` skill was followed for any new migration
- [ ] The `mixhive-lua-agent` skill was followed for any Lua/tool changes
- [ ] Slice definition document (21a or equivalent) is updated with what was actually built
- [ ] Clear "What's next" section in the PR description

---

## Current Status (as of creation of this document)

- **Experiment 5 Slice 5.1** — Fully specified (see 21- PRD + 21a + 048 migration). Ready to start coding once approved.
- **Experiment 1 Slice 1.1** — Fully specified at PRD level (see 22-). Minimal slice defined above. Ready for detailed component spec work.
- **Checklist** — This document.

**Next action after user approval of this checklist:**
Pick the first ticket (strongly recommended: T5.1.2 or T5.1.3 for Experiment 5) and begin implementation.

---

**This document is the single source of truth for what we are committing to build next.** Update it as slices are completed or scope changes.