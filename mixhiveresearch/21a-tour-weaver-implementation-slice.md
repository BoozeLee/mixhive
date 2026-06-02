# Tour Weaver — Minimal Safe First Implementation Slice (Experiment 5)

**Goal of this document:** Define the absolute smallest, safest, highest-value vertical slice that can be implemented immediately after the PRD (21-) and migration draft (048) are reviewed. This is what Codex + Claude Code should start coding first.

---

## 1. Slice Name
**"Make GraphSeedingModal Real" — Gig Logging MVP**

---

## 2. Success Criteria (Definition of Done for this slice)

When this slice is merged and deployed:
- A user can open the existing GraphSeedingModal, fill in the "Recent Gig" tab with real data, click "Log & Seed Graph", and see real nodes + edges created in their Mythic graph.
- They receive immediate, delightful feedback showing the counts.
- The data is queryable via existing `mythic.graph.query` tools.
- No existing migrations were edited.
- All verification gates pass (`tsc --noEmit`, build, manual RLS review).
- The change is small enough that it can be reviewed and shipped in one focused PR.

---

## 3. Explicit Scope — In

**Backend (Codex lead):**
- Migration 048 (`048_log_performance_rpc.sql`) — already drafted.
- One new (or extended) function in `src/lib/database-queries.ts`:
  - `logPerformance(params): Promise<LogPerformanceResult>`
- One new protected route (or extension of existing mythic routes):
  - `POST /api/mythic/log-performance`
  - Accepts the form payload from the modal.
  - Calls the RPC (or equivalent internal logic).
  - Returns `{ nodesCreated, edgesCreated, venueId?, eventId? }`
- Basic error handling and ownership validation.

**Frontend (Claude Code lead):**
- Update `src/components/GraphSeedingModal.tsx`:
  - Replace the `handleSubmitGig` simulation with a real API call (using existing `src/lib/api.ts` patterns if possible).
  - Add proper loading state on the primary button.
  - On success: show the celebratory message with real counts + "Log another" button that resets the form nicely.
  - On error: reasonable user-facing message.
- No visual redesign of the modal itself in this slice (keep the existing form fields exactly as they are today).

**Testing / Verification:**
- Manual happy path test (log a gig → see nodes in DB via Supabase dashboard or a simple query).
- Run full project verification gates before merge.
- Confirm that the new edges are readable by existing Lua agents via `mythic.graph.query`.

---

## 4. Explicit Scope — Out (Do Not Touch in First Slice)

- Any changes to the "Mix Release" or "Collab" tabs in the modal.
- New dedicated "Your Legend" or "Venues" profile section (simple list can come in a follow-up PR).
- Co-billed artist resolution or promoter node creation (the migration draft leaves room; we can keep the first slice to just venue + performed_at).
- Any new Lua agent behavior or "Tour Weaver" agent.
- Rich timeline visualization or "Mythic Map".
- Mobile-specific visual polish beyond making the current form functional.
- Any changes to the 045–047 schema (only additive 048 migration).
- Any new public `mythic.*` Lua tools (not needed for logging itself).

---

## 5. Recommended File Changes (Minimal Set)

1. `supabase/migrations/048_log_performance_rpc.sql` (new — already drafted in this session)
2. `src/lib/database-queries.ts` — add `logPerformance` helper
3. `src/app/api/mythic/log-performance/route.ts` (new file, following existing mythic route patterns)
4. `src/components/GraphSeedingModal.tsx` — replace simulation logic only
5. (Optional but recommended) Small update to `src/lib/api.ts` if a typed client helper is desired

Total changed/added files for the first real PR should be very small (4–6 files max).

---

## 6. Implementation Order (Safest Sequence)

1. Apply / review migration 048 locally (or in a staging environment).
2. Implement the `logPerformance` query helper + RPC call.
3. Implement the API route (with auth + basic validation).
4. Wire the modal (the only frontend change in this slice).
5. Manual test + run `npx tsc --noEmit && npm run build`.
6. PR with clear description referencing this slice doc + the 21- PRD.

---

## 7. Risks & Mitigations (for this tiny slice)

- **Risk:** The RPC is too complex in v1.  
  **Mitigation:** Keep the first version deliberately simple (just venue + event + performed_at). Promoter and co-billed can be added in 049 or a follow-up without schema pain.

- **Risk:** RLS / ownership bugs.  
  **Mitigation:** The function is security definer with explicit checks. Codex must review the function body carefully before the PR is merged.

- **Risk:** Users create duplicate venues.  
  **Mitigation:** Acceptable in v1. We can improve deduplication later via better matching or a "merge venues" admin tool. The graph is resilient to some duplication.

---

## 8. What "Success" Unlocks

Once this slice ships:
- Real `performed_at` data starts flowing.
- The Yield Analyst, Scene Orbit, and future Tour Weaver agents suddenly have high-signal material to work with.
- Users get their first real "the graph knows me" moment.
- We have a proven, safe pattern for all future "log real life activity" features (mix releases, collabs, outcomes).

This is the moment the Mythic system stops being infrastructure and starts being *alive*.

---

## 9. Execution Status Update

**Completed (as of latest work):**
- Migration 048 reviewed and polished
- `log_performance` helper + TypeScript interfaces added
- Full API route created
- `GraphSeedingModal` fully wired to real backend
- Error handling + success state + "Log Another Gig" flow implemented
- Type-check and production build passing

**Remaining for full slice closure:**
- Manual testing in a real Supabase environment (RLS + ownership)
- Apply migration 048 in dev/staging
- Mark this document as complete in T5.1.8

**Ready for Codex + Claude Code to pick up after the 21- PRD and 048 migration are reviewed.**