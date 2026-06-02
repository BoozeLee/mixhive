# MIXHIVE MythicNode Strategy — Phase 6 Research

**Prepared:** 28 May 2026  
**Agent:** MIXHIVE MythicNode Strategy Agent  
**Status:** Draft for Codex + Claude Code handoff  
**Related:** 01-research-synthesis.md, 07-ai-infrastructure-master-plan.md, 10-social-platform-scale-architecture.md, 08-ai-infrastructure-task-todo.md

---

## Executive Summary

MIXHIVE's durable advantage is not another social feed or another DAW-collaboration tool. It is the **first creator-native graph intelligence + agent layer** purpose-built for serious underground DJs and producers who treat music as a career, not a hobby.

**MythicNode** is the codename for MIXHIVE's structured graph of artists, mixes, venues, events, opportunities, labels, promoters, and agent-generated "quests." Combined with per-creator programmable **Lua agents** (already shipping), it enables a new class of features: career-level navigation, explainable opportunity routing, and agent-curated "quest lines" that turn scattered social activity into long-term scene momentum.

This document maps the 2025–2026 competitive landscape, identifies the precise gaps that existing platforms leave for ambitious DJs/producers, and positions MythicNode + Lua agents as the wedge that is extremely hard for SoundCloud, Splice, VI.BE, Spotify, or emerging AI tools to replicate without copying MIXHIVE's entire stack and philosophy.

---

## 1. Competitive Landscape (2025–2026)

### Core Platforms Targeting DJs & Producers

| Platform              | Primary Strength                          | Critical Gap for Serious DJs/Producers                                                                 | MIXHIVE MythicNode + Agent Advantage |
|-----------------------|-------------------------------------------|--------------------------------------------------------------------------------------------------------|--------------------------------------|
| **SoundCloud**        | Timestamped feedback, remix culture, WIP sharing, scene discovery | Flat social graph. No memory of "this remix led to a booking at Fuse." No career-level recommendations. | Full provenance graph: every play, repost, collab, and real-world outcome is queryable. |
| **Splice**            | Samples, stems, Create/Stacks, DAW integration, contests | Excellent for asset exchange; almost zero public reputation layer or opportunity attribution. | Graph can link "this stem pack + this collab thread → this actual gig." |
| **VI.BE (Belgium)**   | Trusted opportunity infrastructure, calls, institutional credibility, Lokale Helden / Belgium Booms | Manual browsing + application. No smart matching beyond basic filters. No "artists like you who applied here succeeded at X." | AI-native opportunity router that learns from the entire Belgian + EU graph of outcomes. |
| **Spotify AI DJ / For Artists** | Personalized listening, streaming analytics | Listener-side only. Opaque algorithms. No creator-side "what should I do next in my career" narrative. | Career AI DJ that narrates your actual graph journey and next high-yield moves. |
| **Groover**           | Paid curator/playlist pitching with guaranteed feedback | Transactional, often generic feedback. No relationship memory or graph. | Free, graph-powered targeting with provenance ("3 similar artists you follow got placed after similar outreach"). |
| **ProCollabs / Pibox / SoundStorming** | Async stem/project management, timestamped review | Strong file/DAW workflows; extremely weak public reputation, booking graph, and long-term opportunity tracking. | The collab becomes a first-class node with attributed outcomes (gigs, releases, follow-on opportunities). |
| **Resident Advisor / Beatport** | Event discovery, charts, taxonomy | Promoter/venue side or commerce side. Artist-side career intelligence is minimal. | Artist owns the graph of "I played here, these artists also played here, this promoter booked 4 of them for festivals." |
| **Bandcamp**          | Direct-to-fan monetization, ownership | Post-release only. Almost no pre-release collaboration or opportunity layer. | Release becomes one node in a larger career narrative the agent can reason over. |
| **Instagram / TikTok / YouTube** | Virality, short-form discovery | Algorithmic black boxes optimized for spikes, not sustainable careers. No structured memory of real-world outcomes. | MIXHIVE becomes the "long-term memory" layer that translates social spikes into booking/ label / scene capital. |

### Synthesis of Gaps (May 2026)

1. **Graph Poverty** — Almost no platform maintains a queryable, attributable graph connecting:
   - Content (mixes, buzz, stems)
   - Social actions (follows, reposts, comments)
   - Real-world outcomes (bookings, releases, grants, residencies, collabs that actually happened)

2. **Career vs. Consumption Intelligence** — Spotify's AI DJ is brilliant at "what should this listener hear next." There is no equivalent for "what should this emerging techno DJ from Ghent do in the next 90 days to increase their booking rate at mid-tier clubs?"

3. **Opportunity Matching is Still Manual or Naive** — VI.BE has the best raw opportunity data in Belgium. Matching remains basic genre + location filters. No learning from historical success patterns across the graph.

4. **Collaboration Tools Are File-Centric, Not Reputation-Centric** — Splice, Pibox, ProCollabs excel at moving audio. They do almost nothing to help an artist understand "which collaborators have the highest historical yield for people at my career stage in my genre and geography?"

5. **Agentic Workflows Are Missing or Dangerous** — Most "AI for musicians" tools are either one-shot generators or fully autonomous (risky). MIXHIVE already has a safe, per-user, sandboxed Lua agent runtime with explicit user confirmation gates. This is a massive unexploited advantage.

---

## 2. Jobs-to-be-Done for MIXHIVE's Core Users

**Primary Persona: "Ambitious Underground Selector / Producer" (25–35, electronic/hybrid genres, treating music as primary or serious secondary career)**

### Recurring Jobs

- **Discovery beyond tracks**: "Find other DJs and producers whose *trajectories* are relevant to mine — not just people who sound similar."
- **Opportunity navigation**: "Given my current momentum (recent plays, collabs, local support), which 3–5 real opportunities should I prioritize this month, and why?"
- **Collab targeting**: "Who should I actually reach out to for a remix or co-production that has a realistic chance of leading to a release or joint gig?"
- **Scene positioning**: "Which venues, promoters, and micro-scenes in my travel radius are currently giving traction to artists at my level?"
- **Career memory & narrative**: "Help me remember and articulate the story of my last 18 months so I can write better press kits, grant applications, and booking emails."
- **Translation of social proof into capital**: "This mix did well on SoundCloud/Instagram last month. What real-world actions should I take *now* while the momentum is warm?"

### Current Tool Fragmentation (User Pain)

Users currently juggle:
- SoundCloud / Mixcloud (distribution + feedback)
- Instagram / TikTok (audience growth)
- Splice / Google Drive / WeTransfer (stems)
- VI.BE / direct emails (opportunities)
- Resident Advisor (research)
- Notes app / Notion (personal CRM of "who I emailed when")

**MythicNode thesis**: MIXHIVE becomes the single structured layer that sits *above* these tools and turns their signals into actionable, attributable intelligence.

---

## 3. Why MythicNode + Lua Agents Is Uniquely Defensible

1. **Data Flywheel Already in Motion**
   - MIXHIVE already captures follows, plays, likes, reposts, comments, mix uploads, buzz, opportunity saves/applications, and Lua agent runs.
   - Migration 029 already created `opportunities` + `artist_goals` + `opportunity_saves`.
   - Lua agent runtime (Lupa + wasmoon) is production-grade and safe-by-design.

2. **Postgres-First Graph (Architecture Constraint from Phase 5)**
   - Research doc 10 explicitly recommends modeling the social graph in Postgres with recursive queries and materialized views before considering Neo4j.
   - This is not a limitation — it is a speed and simplicity advantage for Phase 6.

3. **Per-Creator Programmable Agents (Nobody Else Has This)**
   - Splice, SoundCloud, VI.BE, Spotify cannot safely give users their own executable agents without massive new infrastructure and safety work.
   - MIXHIVE already has the sandbox, KV store, trigger model, and audit log.

4. **Narrative Layer (Quests) Is Extremely Hard to Copy**
   - "Break into the Brussels melodic techno scene in 90 days" is not a playlist or a list of gigs. It is a dynamic, graph-backed quest that an agent maintains, updates on real events, and narrates.

5. **Regional Wedge + Global Ambition**
   - Start with Belgian/EU underground electronic (VI.BE adjacency). The graph density in one region creates compounding returns that global platforms cannot easily match in the long tail.

---

## 4. Positioning Statement (for Product, Marketing, and Partnerships)

> MIXHIVE is the career operating system for underground music creators.
> Where SoundCloud is your stage and VI.BE is the institutional noticeboard, MIXHIVE is the strategic map, the memory, and the personal Mythic Agent that turns every mix, follow, comment, and real-world booking into forward momentum.

**Tagline options**:
- "Your graph. Your agents. Your legend."
- "From signal to stage."
- "The Mythic Layer for Underground Music."

---

## 5. Phase 6 Scope Boundaries (What We Do *Not* Do)

- No external graph database (Neo4j, etc.) in this phase.
- No autonomous outreach (email/DM sending). Agents propose drafts only.
- No scraping of Instagram/TikTok/RA without explicit partner agreements.
- No replacement of DAW collaboration tools (we complement Splice/Pibox).
- Focus on **attribution and recommendation over raw creation**.

---

## 6. Success Metrics (High-Level)

See Document 13 for detailed instrumentation proposal.

- **Graph density**: # of derived `mythic_edge` records per active artist per month.
- **Agent activation**: % of creators who have run at least one Mythic Agent (strategic, not just social automation).
- **Quest completion rate**: % of agent-proposed quests that reach "completed" or "abandoned with learning" state.
- **Opportunity yield**: (Applications that become actual bookings or responses) / (opportunities surfaced by Mythic Agent).
- **Narrative usage**: % of users who export or reference their agent-generated "career narrative" in external materials (press kits, grant apps, booking riders).
- **Cross-tool attribution**: Explicit "this SoundCloud repost + this Lua agent suggestion led to this VI.BE application" events.

---

## 7. Recommended Next Research / Validation Steps

1. **Artist interviews** (5–8 serious Belgian/EU DJs/producers) focused on "last 3 real opportunities you pursued and how you found them."
2. **Shadow VI.BE power users** for one week — map every manual step they take.
3. **Prototype one Mythic Quest** ("Break into Kiosk Radio / Fuse orbit") with 3 pilot artists using manual graph construction.
4. **Competitive teardown** of any new 2026 AI music career tools (if they appear).

---

**Handoff to Codex + Claude Code**: This document + 12-mythicnode-feature-specs.md + 13-mythicnode-graph-and-agent-api.md constitute the complete Phase 6 strategic brief.

The core bet: **The platform that owns the attributed, queryable, agent-reasonable graph of underground music careers wins the next decade of creator infrastructure.** MIXHIVE is positioned to be that platform.
---

## Phase 6 implementation status (31 May 2026)

All Phase 6 deliverables are shipped and live on production (`dpl_2ZwUoUvPgXupJ75cEgRWSCNHQeyz`).

**What was built:**
- `supabase/migrations/064_lua_graph_tools.sql` — 4 security-definer Postgres RPCs (`lua_get_similar_artists`, `lua_get_relevant_opportunities`, `lua_get_quest_momentum`, `lua_propose_quest`), service_role only, rate-limited quest proposals (max 3/30 days)
- `api/lua-agent/run.py` — 4 new `mh.*` tools registered in the Lua sandbox: `mh.get_similar_artists()`, `mh.get_relevant_opportunities()`, `mh.get_quest_momentum()`, `mh.propose_quest()`
- `mythic_strategist` strategic agent — weekly strategy pass; produces 3 collab targets + 3 venue approaches + 2 content ideas via LLM; wired into the Monday cron at 07:00 UTC
- `scene-radar-pulse` starter template — ships in the Agents Gallery; uses the new graph tools
- `quest-momentum-watcher` and `quest-proposer` starter templates — demonstrate momentum + quest proposal flows
- `docs/LUA_AGENTS.md` — Graph & career intelligence section added
- `src/lib/types.ts` — `SimilarArtistResult`, `RelevantOpportunityResult`, `QuestMomentumEntry` interfaces
- 178 tests passing; TypeScript clean; 8/8 smoke checks passing
