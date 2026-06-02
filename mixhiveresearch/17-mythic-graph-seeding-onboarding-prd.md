# PRD: Mythic Graph Seeding & Onboarding Flow

**"Tell us about your recent gigs" — Bootstrap the MythicNode Graph**

**Status:** Draft  
**Date:** 29 May 2026  
**Related:**  
- `mixhiveresearch/12-mythicnode-feature-specs.md`  
- `mixhiveresearch/15-mythic-quest-lines-prd.md`  
- `supabase/migrations/045_mythicnode_graph.sql`  
- `supabase/migrations/046_mythicnode_derivation_and_jobs.sql`  
- `src/lib/mythic-graph-processing.ts`

---

## 1. Problem & Opportunity

The MythicNode graph (artists, mixes, venues, events, opportunities, quests) is the core differentiator of MIXHIVE. However, for new or returning users, the graph is empty on first login.

**Without initial data:**
- Quests have no milestones to complete
- Scene Orbit and other Mythic agents have nothing to reason over
- Yield attribution and career narratives are meaningless
- The "career operating system" promise feels hollow

**The Solution:** A delightful, low-friction onboarding + ongoing seeding flow that lets creators quickly import or log their real-world history, instantly populating their personal MythicNode subgraph.

This is one of the highest-leverage surfaces in the entire product.

---

## 2. Goals

### Primary Goals
- Get users to create at least 5–10 meaningful `mythic_edges` (especially `performed_at`, `engaged_with`, `submitted_to`) within their first session.
- Make the graph feel **alive immediately** — show instant feedback ("You just created your first 3 nodes").
- Directly feed into Quest Lines and Mythic Agents.
- Feel premium, cyber-hive, and respectful of the artist’s real career.

### Secondary Goals
- Reduce cold-start friction for Pro features.
- Create high-quality training data for future similarity / recommendation models.
- Establish the habit of logging real-world activity (gigs, collabs, outcomes).

### Non-Goals (Phase 6/7)
- Full calendar sync (Google/RA import) — future
- Automatic scraping of SoundCloud/Instagram — future (and risky)
- Public verification of logged gigs in v1

---

## 3. Core User Flow: "Seed Your Legend"

### Entry Points
1. **First-time / Post-onboarding** (highest priority)
2. **Dashboard empty state** when graph is sparse
3. **Profile "Legend" section** → "Strengthen your graph" CTA
4. **Agents tab** when a Mythic agent says "I need more data to give good suggestions"
5. **Quest creation flow** — "Want better recommendations? Seed a few recent gigs first"

### Main Flow (Recommended Happy Path)

**Step 1: Welcome to Your Legend**
- Beautiful full-screen or large modal
- Hero copy:  
  *"Your career has a story. Let’s start writing it in the graph."*
- Short explanation: *"Logging real gigs, collabs, and wins powers your agents and quests."*
- Big primary CTA: **"Log my recent activity"**

**Step 2: Quick Wins (Multi-select style)**

Present 4–5 high-signal categories the user can bulk-add:

- **Recent Gigs / Performances** (most important)
- **Recent Mix Releases**
- **Notable Collabs**
- **Key Opportunities Applied To**
- **Important Venues / Promoters I've Worked With**

Each category expands into a fast-entry form.

**Step 2a: Gig Logger (The Killer Feature)**

The most important seeding tool:

Form fields:
- Date (date picker, default to last 18 months)
- Venue / Event name (autocomplete + free text)
- City
- Role (Headline / Support / Resident / Radio / Festival slot / Other)
- Co-billed artists (multi-select or tag input, creates `collab_with` edges)
- Link (optional RA / Instagram / ticket link)
- Notes / memorable moment (optional, becomes part of narrative)

On save:
- Creates `venue` node (if new)
- Creates `event` node
- Creates `performed_at` edge (artist → event/venue)
- Optionally creates `booked_by` if promoter is entered
 - Enqueues `derive_similarity_edges` job via 046

**Instant feedback:**
After logging 1–2 gigs:
- Confetti / hive animation
- "Nice — you just created 4 new nodes in your graph."
- "This will help Scene Orbit give you much better targets."

**Step 3: Review & Refine**

- Visual summary: "Your graph now has X nodes and Y edges"
- Simple graph visualization (honeycomb or force graph using existing CyberHive aesthetic)
- Ability to edit/delete entries
- "What else happened?" nudge

**Step 4: Connect to Value**

- "Because you logged these, we can now suggest better quests."
- Surface 1–2 pre-filled Quest suggestions based on the data they just entered.
- "Enable Mythic Scene Orbit for this artist?"

---

## 4. Ongoing Seeding (Not Just Onboarding)

The flow should be re-usable:

- **"Log a Gig"** floating action or in Profile / Dashboard
- After uploading a new mix → gentle nudge: *"Want to log any gigs where you played this set?"*
- After an opportunity application → "Did this come from a real connection? Log it."
- In Quest view: "Complete this milestone by logging the gig"

This turns graph population into a habit rather than a one-time chore.

---

## 5. Data Model Impact

This flow directly creates:

- `mythic_nodes` of type:
  - `event`
  - `venue`
  - `artist_profile` (for collaborators)
- `mythic_edges` of type:
  - `performed_at` (core)
  - `booked_by`
  - `collab_with`
  - `engaged_with` (for mixes)

It should also optionally create `quest_milestone_evidence` when the user is in an active quest.

All creations should go through (or enqueue) the derivation helpers from migration 046.

---

## 6. Technical Requirements (Codex)

- New or extended RPCs:
  - `log_performance(params)` — creates nodes + edges atomically + enqueues jobs
  - `get_user_graph_summary(user_id)` — node/edge counts + recent activity
- Fast autocomplete for venues (based on existing `mythic_nodes` of type `venue`)
- Graceful handling of duplicates (user logs the same gig twice)
- Mobile-optimized forms (date pickers, tag inputs)

---

## 7. Mobile Considerations

- All forms must work excellently at 320px
- Date picker should be native-friendly
- "Quick log last gig" one-tap flow for power users who gig frequently
- Offline support for draft entries (nice-to-have)

---

## 8. Success Metrics

**Activation**
- % of new users who log at least 3 performances in first 7 days

**Graph Health**
- Average number of `performed_at` edges per active user after 30 days

**Product Usage**
- Correlation between graph density and:
  - Quest creation / completion rate
  - Mythic agent suggestion acceptance rate
  - Retention

**Qualitative**
- "This finally feels like it understands my actual career" (user quotes in interviews)

---

## 9. Phased Rollout

**Phase 6.5 (Now)**
- Basic "Log a Gig" flow (modal or dedicated screen)
- Creates nodes + edges
- Shows instant graph summary

**Phase 7.0**
- Smart suggestions ("We see you played at Fuse twice — want to log the other two times?")
- Integration into Quest creation and Agent proposals
- "Import from RA" light version (manual link pasting + parsing)

**Phase 7.5+**
- Full calendar / RA / Songkick integration
- "Claim your past gigs" from public data + community verification

---

## 10. Open Questions

1. Should logging a gig be required before creating certain types of quests?
2. How do we handle "I played a secret / illegal / unlisted rave" (users want to log it but don’t want public visibility)?
3. Do we give users XP / "Legend points" for seeding the graph? (gamification)

---

**This flow is the single highest-leverage onboarding improvement for the entire MythicNode vision.** Getting it right will make every other feature (Quests, Agents, Attribution) dramatically more powerful from day one.

Ready for design + implementation once approved.