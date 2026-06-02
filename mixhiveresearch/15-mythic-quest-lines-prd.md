# PRD: Mythic Quest Lines

**Status:** Draft – Ready for review  
**Date:** 29 May 2026  
**Related:**  
- `mixhiveresearch/12-mythicnode-feature-specs.md` (original concept)  
- `supabase/migrations/045_mythicnode_graph.sql`  
- `supabase/migrations/046_mythicnode_derivation_and_jobs.sql`  
- `docs/mythic-agents/01-scene-orbit-agent.lua`

---

## 1. Overview

**Mythic Quest Lines** are the flagship user-facing manifestation of the MythicNode system. They turn abstract career goals into living, graph-backed narrative missions with clear progress, agent-generated next steps, and real-world attribution.

A Quest is **not** another todo list. It is a dynamic story the system maintains about a creator’s journey through a specific scene, opportunity cluster, or career arc.

**Example Quest:**
> **"Break into the Brussels Melodic / Leftfield Techno Scene — 90 Day Orbit"**

### Goals

- Make the MythicNode graph **viscerally valuable** to creators on day one.
- Create a sticky, narrative product surface that differentiates MIXHIVE from every other music platform.
- Drive meaningful graph population through user actions and agent proposals.
- Provide a clear "north star" for the Scene Orbit strategic agent.

### Non-Goals (Phase 6 / Early Phase 7)

- Real-time collaborative editing inside quests
- Public quest sharing / social feed integration (future)
- Automatic quest creation without user awareness or approval

---

## 2. Data Model (Grounded in Current Migrations)

Quests and milestones are already defined in migration 045. The key new relationships added by 046 are:

### Core Entities (already shipped)

- `quests`
- `quest_milestones`
- `quest_milestone_evidence` (junction)
- `mythic_nodes` (type = `quest`)
- `mythic_edges` with `edge_type = 'quest_milestone'`

### Data Flow (as of 046)

1. User creates or accepts a quest (proposed by Scene Orbit agent).
2. Agent (or system) proposes milestones. Each milestone can be linked to expected node types.
3. Real events in the graph (mix publish, opportunity submission, `performed_at` edges, etc.) can automatically complete or progress milestones via derivation logic (future expansion of 046 triggers).
4. The Scene Orbit agent runs weekly and proposes new actions + updates quest momentum.

---

## 3. User Experience & States

### 3.1 Entry Points

| Entry Point              | Priority | Description |
|--------------------------|----------|-----------|
| Dashboard widget         | P0       | "Active Quest" card with progress + top 2 next actions |
| Agents tab               | P0       | "Mythic Quests" section + "Start New Quest" |
| Profile                  | P1       | "Legend" section showing completed + active quests |
| Discover / Opportunities | P2       | "Quests this opportunity could help with" suggestions |

### 3.2 Main Quest View (Core Screen)

**Route:** `/quests/:id` or tab inside Agents

**Sections (top to bottom, mobile-first):**

1. **Quest Header**
   - Title
   - Progress bar (X / Y milestones complete)
   - Momentum score (0–100) with subtle animation
   - Time remaining or "Rolling"
   - Status pill (Active / Paused / Completed / Abandoned)

2. **Narrative Summary** (agent-generated or user-editable)
   - 2–4 sentence living description of the quest’s current state
   - "Last updated by Scene Orbit agent 3 days ago"

3. **Milestones** (vertical timeline)
   - Each milestone has:
     - Checkbox / progress indicator
     - Title
     - Description (optional)
     - Evidence chips (if completed) — e.g. "2 mixes published", "Played at Fuse", "Submitted to Kiosk Radio"
     - "Why this matters" (optional, agent-written)

4. **Next Best Actions** (3–5 cards)
   - Generated primarily by the Scene Orbit agent
   - Each card:
     - Action title
     - Rationale (with graph provenance)
     - Primary CTA ("Add to calendar", "View opportunity", "Listen & draft message", etc.)
     - "Why the agent recommended this" (expandable)

5. **Quest Log** (collapsible)
   - Chronological feed of significant events:
     - "Day 17 — You were reposted by [curator]. Momentum +8"
     - "Milestone completed: First Brussels gig"
     - "Agent proposed new target: Ampere Ghent"

6. **Legend Entry** (only visible when quest is completed or abandoned)
   - Beautiful shareable summary (image + text)
   - Export options (PNG, PDF, copy text for press kit)

### 3.3 States

| State              | Description | Key UI Elements |
|--------------------|-------------|-----------------|
| **Empty / No Quest** | User has never had a quest | Big "Start your first quest" CTA + 3–4 suggested templates (Brussels Techno, EU Festival Circuit, Label Demo Orbit, etc.) |
| **Quest Creation** | User is choosing/creating a quest | Template cards + "Custom Quest" form (title, target tags, timeframe) |
| **Active**         | Normal operating state | All sections above |
| **Paused**         | User has paused the quest | "Resume Quest" prominent, log still visible |
| **Completed**      | All milestones done | Celebration state + Legend Entry generator |
| **Abandoned**      | User gave up | "What did you learn?" reflection flow + archive |
| **Loading**        | Data fetching | Skeleton with progress bar + last known momentum |
| **Error**          | Failed to load | "We couldn’t load your quest right now" + Retry + "View in Agents tab" |

### 3.4 Mobile Considerations (320px–414px)

- Milestones collapse into a compact list with "Show details" expanders.
- Next Actions become a horizontal scrollable carousel or stacked cards.
- Quest Log is collapsed by default.
- Primary CTAs use full-width buttons.
- Momentum score uses a prominent circular progress indicator.

---

## 4. Agent Integration

**Primary Agent:** Scene Orbit (see `docs/mythic-agents/01-scene-orbit-agent.lua`)

**Interaction Model:**

- The agent proposes new quests and updates existing ones via the existing suggestion system (`mh.propose_action` + `mh.propose_quest_update`).
- All proposals appear in a unified "Mythic Suggestions" inbox (shared with other strategic agents).
- User must explicitly accept, edit, or dismiss proposals.
- Accepted proposals create or modify `quest` / `quest_milestone` rows and create `recommended_by_agent` edges.

**Future (Phase 7+):**
- Quest can be "adopted" by a strategic wasmoon agent that has slightly higher privileges for read-only aggregated signals.

---

## 5. API & Data Contracts (Codex)

### New or Extended Endpoints (suggested)

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/quests` | List active + recent quests for current user |
| POST   | `/api/quests` | Create new quest |
| GET    | `/api/quests/:id` | Full quest detail + milestones + recent log |
| PATCH  | `/api/quests/:id` | Update status, title, description |
| POST   | `/api/quests/:id/milestones` | Manually add a milestone |
| POST   | `/api/quests/:id/milestones/:mid/complete` | Mark milestone complete + attach evidence |
| POST   | `/api/quests/:id/pause` | Pause quest |
| POST   | `/api/quests/:id/abandon` | Abandon with optional reflection |
| GET    | `/api/quests/suggestions` | Agent-proposed quests and actions |

### Key RPCs / Helpers Needed

- `get_quest_with_milestones(quest_id)`
- `propose_quest_milestones(quest_id)` (used by Scene Orbit agent)
- `record_quest_milestone_evidence(quest_id, milestone_id, node_ids[])`
- `update_quest_momentum(quest_id, new_momentum)`

---

## 6. Success Metrics (Phase 6 / 7)

**Leading Indicators**
- % of active users who have created or accepted at least one quest
- Average number of milestones completed per active quest
- Agent proposal acceptance rate on quest-related suggestions

**Lagging / Business Indicators**
- Correlation between high quest activity and:
  - Increased opportunity applications
  - Increased `performed_at` edge creation (real gigs logged)
  - Higher retention at 30/60/90 days
- Number of Legend Entries exported (strong signal of perceived value)

---

## 7. Phased Rollout Recommendation

**Phase 6.5 (Current)**
- Quest creation + manual milestone management
- Basic agent proposal surface (using existing suggestion system)
- Dashboard widget (read-only)

**Phase 7.0**
- Automatic milestone progress via 046-style derivation triggers
- Rich Quest Log
- Legend Entry generator
- "Log a Gig / Performance" flow that can complete milestones

**Phase 7.5+**
- Strategic wasmoon Scene Orbit agent with deeper graph access
- Quest templates marketplace / community forks
- Public or semi-public quest sharing (optional)

---

## 8. Open Questions

1. Should users be able to have multiple active quests at once, or should we enforce a soft limit of 1–2?
2. How much should the system "nudge" users who have abandoned quests vs. respecting their choice?
3. Do we want a "Quest Coach" mode where the agent can send gentle weekly check-ins even when the user is not actively using the app?

---

**Next Steps After PRD Approval**

1. Codex: Extend derivation logic in 046 (or 047) to automatically progress quest milestones.
2. Claude Code: Build the core Quest detail view + Dashboard widget.
3. Shared: Define the exact shape of agent proposals for quests.

This PRD is intentionally detailed enough that both Codex and Claude Code can begin implementation planning immediately.