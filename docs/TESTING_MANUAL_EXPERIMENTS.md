# MIXHIVE – Comprehensive Manual Testing Guide (Experiments 1 & 5)

This document provides a complete, step-by-step manual testing script for the two main differentiation experiments.

## Prerequisites

- Local or staging Supabase project with latest migrations applied (up to 050)
- Running Next.js dev server (`npm run dev`)
- Test accounts (at least 2-3 artist profiles)
- Browser with dev tools open

---

## Experiment 5 – Tour Weaver / Performance Logging (Slice 5.1)

### Test 1: New User Signup → Auto Profile + Mythic Node Creation

1. Sign up with a new email.
2. After signup, query Supabase:
   ```sql
   SELECT * FROM profiles WHERE id = '<new-user-id>';
   SELECT * FROM mythic_nodes WHERE owner_id = '<new-user-id>' AND node_type = 'artist_profile';
   ```
3. **Expected**: Both a `profiles` row and a `mythic_nodes` (type=`artist_profile`) row exist.

### Test 2: Basic Performance Logging via Modal

1. Open the app as a logged-in user.
2. Trigger the GraphSeedingModal (profile or dashboard).
3. Fill in "Recent Gig" tab with valid data.
4. Click "Log & Seed Graph".
5. **Expected**:
   - Success toast appears.
   - Modal shows success state with "Log Another" and "Done".
   - New `venue`, `event`, and `performed_at` edges appear in DB.

### Test 3: "Log Another" Flow

1. After successful log, click **"Log Another Gig"**.
2. Form should reset cleanly.
3. Log a second gig quickly.
4. **Expected**: Both performances are correctly recorded with separate nodes/edges.

### Test 4: Error Handling & Validation

- Try submitting without a venue name → Should show inline error (no crash).
- Try invalid date → Zod should reject at API level.

### Test 5: RLS / Security

- Log in as User A.
- Use browser dev tools or curl to POST to `/api/mythic/log-performance` with `artistId` = User B's ID.
- **Expected**: Should be rejected (either by RLS or by forcing `artistId = auth.uid()` in the route).

---

## Experiment 1 – Mythic Co-Production Sessions (Slice 1.1)

### Test 1: Session Creation

1. Go to profile or a mix page.
2. Click "Start Mythic Session".
3. Fill title + optional description.
4. Create session.
5. **Expected**:
   - `collab_sessions` row created.
   - Creator is added to `collab_session_participants` as owner.

### Test 2: Multi-Participant Access

1. As owner, invite another user (manual insert into participants table for now, or via future UI).
2. Log in as invited user.
3. Query sessions the user can see.
4. **Expected**: Invited user can see the session.

### Test 3: End Session + Job Enqueue

1. As owner, end the session.
2. Check:
   - Session status becomes `ended`.
   - A new row appears in `mythic_graph_jobs` with type `collab_session_post_process`.

### Test 4: RLS on Sessions

- Non-participant tries to view or end the session.
- **Expected**: Blocked by RLS.

---

## Cross-Cutting Tests

### Auth & Profile Consistency

- Test signup with different providers (email, Google, etc.).
- Verify both `profiles` and `mythic_nodes.artist_profile` are created.

### Graph Integrity

After running tests for both experiments, run these queries:

```sql
-- All artists should have a profile node
SELECT p.id, p.username, 
       (SELECT count(*) FROM mythic_nodes WHERE owner_id = p.id AND node_type = 'artist_profile') as has_profile_node
FROM profiles p;

-- Recent performed_at edges
SELECT * FROM mythic_edges 
WHERE edge_type = 'performed_at' 
ORDER BY created_at DESC LIMIT 20;
```

### Concurrent Usage

- Open two browser tabs as the same user.
- Rapidly log two performances or create two sessions.
- Verify no duplicate data or constraint violations.

---

## Postman / API Testing Collection (Recommended Endpoints)

You can import these into Postman or use curl:

### Performance Logging
```
POST {{baseUrl}}/api/mythic/log-performance
Authorization: Bearer {{access_token}}
Body: {
  "date": "2026-06-15T20:00:00Z",
  "venueName": "Fuse",
  "city": "Brussels",
  "role": "support"
}
```

### Collab Sessions
```
POST {{baseUrl}}/api/mythic/sessions
Body: { "title": "Late Night Techno Sketch" }
```

```
PATCH {{baseUrl}}/api/mythic/sessions
Body: { "sessionId": "..." }
```

---

## Recommended Automated Test Additions (Future)

- Vitest / Playwright tests for:
  - Modal submission flow
  - API route validation (Zod)
  - RPC functions (using Supabase test client)

---

**Run this checklist after every major deployment or before merging large PRs.**

**2026-05-29 Update (5-item realtime polish tranche deployed)**: The full create → room (real usernames + cross-tab typing + stems) → end → job (collab_with + inspired_by) → review (real edges) → approve (metadata.status + provenance) vertical is now complete and delightful. Use two tabs + two test accounts for the Exp 1 realtime tests. Profile page now has the primary "Start Mythic Session" entry point (own profile only).

Last updated: 2026-05-29 — 5 polish items + all questions/tasks deployed.