# Spec: Mythic Metrics Dashboard (Graph + Yield Signals)

**"What actually moved the needle?" — Making the MythicNode flywheel visible and actionable.**

**Status:** Draft  
**Date:** 29 May 2026  
**Related:**  
- `mixhiveresearch/12-mythicnode-feature-specs.md` (especially Feature 4: Opportunity Routing & Attribution)  
- `mixhiveresearch/13-mythicnode-graph-and-agent-api.md` (Success Metrics section)  
- `mixhiveresearch/14-mythicnode-followups.md`  
- `mixhiveresearch/15-mythic-quest-lines-prd.md`  
- `supabase/migrations/045_mythicnode_graph.sql` + `046_mythicnode_derivation_and_jobs.sql`  
- `src/lib/mythic-graph-processing.ts`

---

## 1. Vision

The most powerful feature of MythicNode is **attribution** — the ability to see which of a creator’s actions (mixes, posts, agent suggestions, logged gigs, collabs) actually led to real career outcomes (bookings, responses, releases, strong relationships).

A dedicated **Mythic Metrics Dashboard** turns this invisible data into a living, beautiful, and motivating surface. It is the "Career Scientist" view that makes the Yield Attribution agent feel magical and trustworthy.

This dashboard should feel like a premium intelligence layer — black/gold, restrained, data-rich but not overwhelming, with a sense of discovery and narrative.

---

## 2. Goals

### Primary Goals
- Make the graph and yield system **visible and emotionally rewarding**.
- Help users understand **which behaviors actually work** for them specifically.
- Drive better usage of Mythic Agents and Quest Lines by showing clear ROI.
- Create a surface that power users (and future partners/labels) will screenshot and share.

### Secondary Goals
- Surface data quality issues (sparse graph → gentle nudges toward seeding flow).
- Provide rich signals for future recommendation models.
- Give the Yield Attribution strategic agent a natural home for its output.

### Non-Goals (Phase 6/7)
- Public leaderboards or social comparison
- Complex custom dashboards (future power-user feature)
- Real-time updating (periodic refresh is fine)

---

## 3. High-Level Information Architecture

**Primary Location Options (recommended order):**

1. **Dedicated tab** in the main Dashboard (strongest)
2. New top-level nav item: **"Insights"** or **"Mythic"**
3. Deeply integrated into **Profile > Legend / Analytics** (ProfileAnalyticsDashboard already exists — extend it)
4. Prominent section inside **/agents** (next to Agent Inbox)

**Recommended:** Start as a rich section on the main Dashboard + a full dedicated page at `/insights` or `/mythic/insights`.

---

## 4. Dashboard Sections (Wireframe-Level)

### 4.1 Hero Summary Bar (Top)

- "Your Mythic Graph" 
  - X nodes • Y edges • Z real-world outcomes attributed
- Momentum score (average across active quests or personal graph health)
- "Your graph grew 47% this month" (with sparkline)

Visual: Large honeycomb or subtle force-graph preview that links to a fuller graph explorer (future).

### 4.2 Yield Attribution Panel (The Crown Jewel)

**Title:** "What Actually Moved the Needle"

Two columns / tabs:

**High-Yield Patterns**
- Cards or list items showing:
  - Pattern name (e.g., "Logging gigs at mid-tier clubs within 48h of posting a mix")
  - Lift multiplier (e.g., "3.2× baseline conversion for artists like you")
  - Evidence count + links to specific edges/outcomes
  - "Double down" quick action (creates or strengthens a Quest milestone)

**Low-Yield / Quiet Killers**
- Honest but kind callouts:
  - "Cold DMs via Groover have produced 0 confirmed responses in the last 90 days for artists at your level."
  - Recommendation + "Deprioritize" button

This section should be heavily powered by (and feed back into) the **Mythic Yield Analyst** strategic agent.

### 4.3 Quest Health & Momentum

- Overview of active quests with momentum trends
- "Milestones completed this month" with attribution (which ones were auto-detected vs manually logged)
- Correlation view: "Quests with high agent proposal acceptance are completing 2.1× faster"

### 4.4 Graph Growth Over Time

- Beautiful timeline / area chart:
  - Nodes created (stacked by type: performances, collabs, opportunities, etc.)
  - Edges created
  - Outcomes attributed
- Breakdown by source: Agent-proposed vs User-logged vs Automatic derivation

Key insight callout: "68% of your high-yield edges this quarter came from agent suggestions you acted on."

### 4.5 Agent Performance

For users who have enabled Mythic agents:

- Table or cards per agent:
  - Suggestions surfaced
  - Acceptance rate
  - Downstream attributed outcomes
- "Scene Orbit has been your highest-ROI agent (4 real gigs traced back)"

### 4.6 Data Quality & Nudges (Bottom)

- "Your graph is currently X% dense for artists at your career stage."
- Gentle, non-shaming CTAs:
  - "Log 2 more recent gigs to unlock better Quest recommendations"
  - Link directly to the seeding flow from #4

---

## 5. Data Requirements & Instrumentation

This dashboard is only as good as the data model from 045/046.

**Core Signals Needed:**

- `mythic_nodes` + `mythic_edges` with good `source_event` and `metadata` (especially `recommended_by_agent`)
- `yielded_outcome` edges (the most important)
- `quest_milestone_evidence` + quest momentum history
- `mythic_graph_jobs` success/failure + processing time (for observability)
- Agent run outcomes linked to suggestions that were accepted

**Recommended New / Extended Tables (if not already sufficient):**

- `mythic_analytics_events` (append-only, as suggested in doc 13) for high-cardinality signals
- Materialized views or periodic aggregation jobs for "yield by pattern" (this can be expensive — run nightly or via the worker)

---

## 6. Technical & API Needs (Codex)

- New RPCs / queries:
  - `get_mythic_yield_summary(user_id, window_days)`
  - `get_graph_growth_timeseries(user_id)`
  - `get_agent_performance_summary(user_id)`
  - `get_attributed_outcomes_for_edge(edge_id)` (for drill-down)
- Efficient aggregation layer (could live in the Mythic graph worker)
- Caching strategy (Redis) — this data doesn't need to be real-time

---

## 7. Mobile Experience

- Dashboard should be vertically scrollable and delightful on mobile.
- Key charts must have good mobile fallbacks (simplified views or tappable cards that expand).
- Primary actions ("Double down", "Log more activity") must be thumb-friendly.
- Consider a "Mythic Snapshot" weekly push notification that surfaces the single most interesting insight.

---

## 8. Success Metrics for This Feature

**Usage**
- % of active users who visit the Insights dashboard at least once per week
- Time spent on the Yield Attribution panel (should be the stickiest section)

**Behavioral Change**
- Increase in logged `performed_at` / `yielded_outcome` edges after users see the dashboard
- Higher acceptance rate of suggestions from agents that appear on the dashboard

**Qualitative**
- Users saying things like "I finally understand why some months feel more successful than others."

---

## 9. Phased Rollout

**Phase 6.5 (MVP)**
- Basic dashboard with:
  - Graph growth chart
  - Simple high-yield / low-yield list (initially rule-based or lightly LLM-assisted)
  - Quest momentum overview
- Strong integration with the seeding flow

**Phase 7.0**
- Full agent performance attribution
- "Why this pattern worked for you" explanations with real edge provenance
- Exportable reports (PDF / shareable image)

**Phase 7.5+**
- Predictive "If you do more X, expect Y more outcomes" modeling
- Cohort comparisons (anonymized: "Artists who focused on this scene saw 2.8× better booking rates")

---

## 10. Open Questions

1. Should this dashboard be visible to Free users (read-only, limited data) or Pro-only?
2. How much LLM interpretation vs raw data do we show? (Risk of over-confident or wrong insights)
3. Do we allow users to manually mark outcomes as "yielded" from specific actions (closing the attribution loop)?

---

**This dashboard is the capstone of the entire MythicNode experience.** When done right, it turns scattered activity into clear, motivating intelligence and makes every other Mythic feature feel 10× more valuable.

Ready for design and implementation once the core data model (045/046 + worker) has enough real events flowing through it.