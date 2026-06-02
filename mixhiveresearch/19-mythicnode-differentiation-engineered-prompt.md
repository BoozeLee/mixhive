# MIXHIVE MythicNode Differentiation Push — Engineered Agent Prompt (Phase 6.5 / 7)

**Prepared for:** MIXHIVE Codex + Claude Code + Strategy/Product agents  
**Date context:** Post-implementation of migrations 045–047, live mythic strategic Lua agents, GraphSeedingModal, job processor integration, media pipeline (041/040/036), and research 10–18 (May 2026 baseline)  
**Mission:** Stop catching up. Exploit the now-live unique stack (Postgres-backed MythicNode graph + safe per-creator + strategic Lua agents + hardened media status + Supabase Realtime + VI.BE-adjacent opportunity surface) to make MIXHIVE the uncopyable AI-native career operating system for underground electronic DJs and producers.

Use this entire document as the system/context prompt for the next agent session.

---

## 1. Objectives

Map the **current (mid/late 2026)** competitive landscape for social, AI-assisted, and career platforms targeting serious DJs, producers, and underground electronic creators (with special attention to Belgian/Flemish/VI.BE ecosystem).

Identify precise gaps that remain even after BandLab/Soundtrap real-time collab, Spotify AI DJ expansions, Venice/MNRGS/SymphonyOS career AI tools, Viberate analytics, RA/SoundCloud virality, and VI.BE opportunity infrastructure.

Design 4–5 high-leverage **differentiation experiments** (not just features) that:
- Are now feasible *because* the MythicNode graph (045–047), derivation jobs, mythicTools surface, 4 strategic Lua agents (collab_weaver, narrator, scene_orbit, yield_analyst), GraphSeedingModal, moderation/media pipeline, and job-processor pattern are live.
- Are extremely hard for competitors to replicate without copying MIXHIVE’s full modular monolith + Postgres graph + safe Lua runtime + provenance discipline.
- Directly advance the thesis: MIXHIVE becomes the single structured layer that turns fragmented signals (social spikes, collabs, VI.BE calls, RA plays, SoundCloud reposts) into attributable, agent-navigable career momentum and narrative.

For each experiment produce:
- A crisp product narrative and "why now / why us" (grounded in 2026 market).
- MythicNode graph deltas (new node/edge types or derivation patterns if needed; reuse existing `performed_at`, `collab_with`, `submitted_to`, `recommended_by_agent`, `yielded_outcome` wherever possible).
- Concrete Lua agent behaviors (using the *current* `mythicTools` surface + proposed minimal safe extensions; respect the two-runtime split: Lupa user agents vs wasmoon strategic).
- Clear handoff:
  - **Codex ownership:** Any schema deltas (new migration via the mixhive-migration skill), background job types or expansions to mythic_graph_jobs / audio_jobs pattern, new or extended Lua tool functions in `src/server/lua-agents/tools/mythic.ts`, API routes, RLS adjustments, enqueue/mark helpers.
  - **Claude Code ownership:** UI flows, states (agent suggestion cards, quest progress, yield attribution visualizations, collab session presence), copy tone, integration points into existing views (dashboard, opportunities, profile, feed).
- Success metrics and lightweight experiment design (A/B or cohort on suggestion acceptance → real-world outcome edges).

**Non-goals for this phase:** Full general-purpose browser DAW (we are not competing with Ableton-in-browser). Paid third-party APIs without clear ROI. Breaking the monolith or adding external graph DBs.

---

## 2. Discovery — 2026 Market Reality + Current MIXHIVE State

### 2.1 Competitive Landscape (Fresh 2026 Scan)

**Discovery & Social Proof Layer (still fragmented, virality-optimized):**
- TikTok, Instagram Reels, YouTube (full mixes + "human-made / not AI slop" labeling is now a deliberate signal), SoundCloud (repot culture + Hook legal remixes), RA.co (the credibility layer for underground electronic — profiles, events, reviews, mixes), Mixcloud, Bandcamp.
- Newer: lazyrecords (2025, algorithm-free DJ discovery pulling from Discogs + YouTube).
- Trend: Authenticity backlash against generative AI flood. Platforms and artists are explicitly labeling human-made work. This is a massive tailwind for MIXHIVE’s provenance graph and confirmation-gated Lua agents.

**Collaboration Layer:**
- **BandLab**: Free, social, cloud DAW with mature real-time "Live Sessions" (up to 50 collaborators editing simultaneously, forking, chat, stem separation). Strong community discovery.
- **Soundtrap (Spotify)**: Excellent real-time browser collab + chat/video, education-heavy, unlimited cross-device. No strong career graph or underground electronic focus.
- **Splice**: Pivoted away from native real-time DAW collab (discontinued earlier Studio real-time features). Strong in async Stacks, mobile ideation (Splice Mic), AI-assisted sound matching, and feeding high-quality assets into other tools. Excellent for inspiration, weak on public reputation/outcome attribution.
- Gap: All are either generic social DAWs or asset libraries. None maintain a queryable graph that links a co-production session to the actual booking or label interest that resulted from it.

**Career / "AI Manager" Layer (rising fast, still siloed):**
- Venice Music Co-Manager, MNRGS.AI (MNGRS) — virtual career ally for release strategy, audience building, personalized guidance.
- SymphonyOS — "marketing operating system" that generates and automates campaign plans at scale (used by distributors serving indies).
- un:hurd — automated promo across Spotify/TikTok/YouTube/Meta + playlist pitching + fan hubs + release cycle tooling.
- Viberate — DJ/electronic-specific analytics, booking tools, playlist/festival pitching, professional one-sheets, advances against royalties. Very relevant for our audience.
- TRINITI (CreateSafe) — ambitious full "music operating system" (creation + marketing + distribution + IP/CRM/finance). Artist-first positioning with GrimesAI heritage.
- Spotify for Artists: Listener-side AI DJ heavily expanded (multi-language personas, voice requests, SongDNA for creative connections/credits/storytelling in 2026). Strong anti-slop protections + "artist-first AI" partnerships with majors. Emphasis on human editorial, verifiable identity, and storytelling. *No creator-side career narrator that reasons over real-world outcomes (gigs, collabs that actually converted).*

**Opportunity Infrastructure (Belgium-specific strength):**
- VI.BE (vi.be): The trusted platform for Flemish/Brussels music makers. 20k+ acts, 800+ organizers. Free profiles + "calls" (open opportunities for gigs, contests, festivals, residencies). Lokale Helden, Stoemp!, Belgium Booms (export). Extremely active for underground electronic DJs (gemak! Festival DJ Contest, Maanrock DJ Rally, PULSE, Zero For Three, etc. in 2026). This is real, high-signal data — not just another listing site.

**Synthesis of Remaining Gaps for Serious Underground Electronic Creators (2026):**
1. **Graph Poverty & Attribution Amnesia** — Even the best career AI tools and collab platforms have almost no structured, queryable memory of "this specific collab session + this VI.BE application + this RA-listed gig → this label interest / follow-on booking." Virality spikes on TikTok/IG disappear; there is no durable career capital layer.
2. **Listener AI vs Creator Career AI** — Spotify’s AI DJ (and similar) is brilliant for fans. Creator tools are either marketing automation or generic "virtual manager" advice. None give an ambitious techno DJ from Ghent a personalized, graph-grounded narrative: "Your recent performed_at edges at Fuse and shared collab_with triangles with X and Y put you in the top cohort for this Belgium Booms showcase. Here is the exact quest line + draft application."
3. **Real-time Collab is Generic** — BandLab and Soundtrap deliver excellent simultaneous editing. Zero provenance, zero automatic linkage to the artist’s MythicNode legend, zero downstream yield attribution. The collab dies in the project file.
4. **Opportunity Matching Remains Manual or Naive** — VI.BE calls are gold for our users. Matching and preparation is still browse + apply. No agent that says "3 similar artists (via venue + genre + listener overlap edges) succeeded at this exact call last year; here is the contextualized draft + recommended mix."
5. **Agentic Workflows Exist but Lack Safe Graph Memory + User Control** — The new wave of AI career tools are powerful but often black-box or fully autonomous. MIXHIVE already has the opposite: a sandboxed, per-user programmable Lua runtime + strategic wasmoon agents with explicit confirmation gates. This is now a massive, shipping differentiator.

### 2.2 Current MIXHIVE State (Ground Truth for This Phase — Read These Before Any Design)

**Media & Moderation (Phase 5 — largely complete):**
- `upload_status` on mixes (uploaded → processing → ready | failed) via migration 041.
- `audio_jobs` table + worker pipeline (040/042) with job types waveform/metadata/bpm_key_mood/tracklist. Helpers: enqueue/mark complete/failed in database-queries.ts + audioWorker.ts + /api/audio/process.
- `moderation_signals` (036) + first-pass Lua moderation agent + internal API skeleton (`/api/moderation/signals` routes + lib/moderation.ts).
- Validation rules documented in 10-social-platform-scale-architecture.md (audio: MPEG/WAV/FLAC/OGG/AAC/MP4 ≤100MB; images: JPEG/PNG/WEBP/AVIF ≤10MB).
- All private media via RLS + signed URLs.

**MythicNode Graph (Phase 6 foundation — live):**
- Migrations 045 (`mythic_nodes`, `mythic_edges`, `quests`, `quest_milestones`), 046 (derivation + `mythic_graph_jobs`), 047 (similarity helpers).
- Node types implemented: artist_profile, mix, buzz, event, venue, opportunity, promoter/label/curator, quest, agent.
- Edge types include: performed_at, booked_by, submitted_to, collab_with, engaged_with, recommended_by_agent, followed, yielded_outcome (and more via 047).
- Traceability: `source_table` + `source_id` + `metadata.agent_id` on edges.
- Current derivation: triggers for high-signal events + background worker pattern (exactly like audio_jobs).
- Seeding UI: GraphSeedingModal.tsx (onboarding "tell us about your recent gigs").
- Read surface: `src/server/lua-agents/tools/mythic.ts` exports `mythic.quest.get_active`, `mythic.graph.query`, `mythic.yield.get_summary` (and expanding).
- 4 strategic wasmoon agents live (examples in `src/server/lua-agents/agents/`):
  - `mythic_collab_weaver.lua` — uses recent collab_with + performed_at edges + LLM prompt to propose high-potential collab missions.
  - `mythic_narrator.lua`, `mythic_scene_orbit.lua`, `mythic_yield_analyst.lua`.
- Job integration: `src/lib/mythic-graph-processing.ts` + job-processor.ts.
- API: `/api/mythic/propose` and `/api/mythic/graph`.
- RLS + owner_id discipline fully in place.

**Lua Runtime (mature, two paths):**
- User automation: Lupa/Python on Vercel (`/api/lua-agent/run.py`) — safe social reactions (on_follow, on_mix_upload, on_comment, on_schedule, manual, etc.). Full `mh.*` surface (db.read, comment, post_buzz, notify, follow, kv_set, …) with explicit user confirmation for risky actions.
- Strategic agents: wasmoon (Node) runtime for MIXHIVE-owned agents. Health probe at `/api/agents/wasmoon-test`.
- Docs: `docs/LUA_AGENTS.md` (triggers, contract), `docs/mythic-agents/README.md`.
- Skill: Always invoke `/home/kilisan/dj-nef-website/mixhive/.claude/skills/mixhive-lua-agent/SKILL.md` for any changes.

**Other Live Foundations:**
- Opportunities table + graph integration (029 + later).
- Supabase Realtime for notifications/feed.
- Strong Belgian/underground electronic positioning + explicit VI.BE partnership intent in early research.
- Verification: `npx tsc --noEmit`, `npm run build`, smoke scripts, `db:types:check`.

**What the Original Phase 6 Research (11–14) Got Right vs What Changed:**
- The vocabulary, graph-first Postgres approach, derivation strategy, safety gates, and "career narrator vs listener AI DJ" positioning were excellent and are now shipping.
- The prompt you are reading must treat 045–047 + the 4 strategic agents + GraphSeedingModal + current mythicTools as the new baseline. Do not re-propose the foundation. Propose the *next* layer of experiments that make the platform *excel* and uncopyable.

---

## 3. MythicNode Vocabulary & Lua Surface — Current + Minimal Deltas

**Reuse first.** The existing node/edge types, quests, and `recommended_by_agent` / `yielded_outcome` edges are sufficient for 80% of new experiments. Only propose small, justified extensions (new edge subtype in metadata, or one new derivation helper) when it unlocks a flagship experiment.

**Current Lua Tool Surface (as of this prompt — quote accurately in designs):**
From `src/server/lua-agents/tools/mythic.ts` and agent examples:
- `mythic.quest.get_active(profileId)`
- `mythic.graph.query({from_node_id?, to_node_id?, edge_type?, limit?})`
- `mythic.yield.get_summary(profileId, days?)` (expand as needed)
- Strategic agents already call `mixhive["db.read"]` / `db.read_one` for profiles, mythic_edges, etc., plus LLM prompting inside the agent.

**Proposed Minimal Safe Extensions (only if a specific experiment requires them):**
- `mythic.graph.find_collab_triangles(artist_id, min_shared_venues?, max_distance_km?)` — thin wrapper over existing 047 helpers or new RPC.
- `mythic.opportunity.relevant(profile_id, timeframe_days)` — reads opportunities + graph signals (performed_at overlap, genre, prior submitted_to success rate).
- `mythic.yield.record_outcome(artist_id, opportunity_id?, edge_ids[], outcome_type, metadata)` — the critical "this action actually yielded a real-world result" write path (used by both agents and manual "I got the gig" flows).

All new tools must be read-heavy by default, auditable, and gated behind the existing suggestion/confirmation pipeline for any action that touches user-visible state.

---

## 4. Flagship Differentiation Experiments (2026–2027)

Design 4–5. Prioritize depth over breadth. Each must feel like a "MIXHIVE-native" experience that competitors cannot easily bolt on.

### Experiment 1: Mythic Co-Production Sessions (Real-Time Collab + Automatic Provenance)
**Narrative:** "The collab that actually advances your legend."
**Why now / why us:** BandLab and Soundtrap own generic real-time editing. MIXHIVE can own *attributed, underground-electronic, career-yielding* real-time sessions for the exact creators who use VI.BE calls and RA venues. A successful session automatically writes `collab_with` + `inspired_by` edges, seeds a quest milestone, and surfaces in the yield analyst.

**Graph:**
- Reuse `collab_with` (artist ↔ artist), add lightweight session node or treat the mix/project as a `mix` node with special metadata.
- On save/fork: write `recommended_by_agent` or manual `collab_with` edges carrying `session_id` + participant list.
- Later: `yielded_outcome` edges when the resulting track leads to a booking.

**Lua Agent Behaviors (Collab Weaver + new Session Weaver persona):**
- On session start (or manual trigger): "Here are 2 artists in your current scene_orbit with complementary recent performed_at venues and high historical yield on similar collabs. Invite them?"
- On save: propose a short "collab mission" description + tags that the system can turn into a quest milestone.
- Safety: Never auto-publish. All edges and quest updates require explicit user confirmation. Session data lives in Supabase Storage + Realtime (or lightweight Yjs room for state if we prototype CRDT path).

**Codex Handoff:**
- New (or extended) job type for post-session graph derivation (lightweight — most edges written synchronously on save via service role + RLS-safe RPC).
- Realtime channel design for presence + cursors (Supabase Realtime + optional Yjs for conflict-free arrangement state; audio assets referenced, not embedded).
- Minimal new migration if `session_participants` or `collab_session` table is justified (otherwise use existing edges + a `mixes` extension).
- Invoke mixhive-lua-agent skill for any new tool surface.

**Claude Code Handoff:**
- New "Mythic Session" entry point (from profile, mix, or quest).
- Presence avatars + "who is editing what" (tied to mythic_nodes).
- Post-session review screen that shows proposed edges/quest updates for approval.
- Copy: "This session just wrote itself into your legend."

**Success Metrics (lightweight experiment):**
- % of sessions that produce at least one new `collab_with` or quest milestone.
- Downstream: sessions that later correlate with `yielded_outcome` (bookings, releases) within 90 days (tracked via GraphSeedingModal-style manual confirmation + opportunity applications).
- Cohort comparison: users who ran ≥1 Mythic Session vs matched controls on opportunity application success rate.

### Experiment 2: Production Yield Attribution Dashboard + Career Narrator v2 (Realizing 18- + Narrator Agent)
**Narrative:** "See exactly which actions moved the needle in your actual career — not just streams."
**Why now:** 18-mythic-metrics-dashboard-spec.md exists. The graph (yielded_outcome edges, agent_id on recommended_by_agent) + 4 strategic agents are live. Time to make the "career yield" story visible and actionable in the main product.

**Graph:**
- Heavy use of `yielded_outcome` + parent edges (the original action that led to the outcome).
- New lightweight "outcome" confirmation flow (manual + agent-assisted) that links a real-world event back to prior nodes/edges.

**Lua:**
- Expand `mythic_yield_analyst` + `mythic_narrator` to consume the new dashboard data.
- Weekly "Strategy Pass" that surfaces 3 high-yield patterns + 1 "double down" recommendation + 1 "stop doing" (with evidence from the graph).

**Codex:**
- Any new aggregation views or materialized helpers (follow 046/047 pattern).
- Secure read paths for the dashboard (RLS + service role for agent jobs).

**Claude Code:**
- The dashboard surface itself (per 18- spec, updated for live schema).
- Narrative "chapter" cards powered by the narrator agent (inspired by Spotify AI DJ voice but *creator career* chapters: "The Fuse Breakthrough Chapter", "The Collab That Opened Belgium Booms").
- One-click "Claim this outcome" that writes the `yielded_outcome` edge (with provenance).

**Metrics:**
- Dashboard adoption (views + claimed outcomes per user per month).
- Correlation between claimed outcomes and future opportunity success rate.
- Agent suggestion acceptance rate → downstream yield lift (the core A/B for the whole Mythic system).

### Experiment 3: VI.BE Opportunity Intelligence + Agent-Assisted Applications
**Narrative:** "Turn the best local opportunity platform into your personal career accelerator."
**Why now:** VI.BE calls are high-signal and active for exactly our users in 2026. MIXHIVE already has the opportunity graph node type + submitted_to edges. We can become the "smart brain" layer that VI.BE itself may never build.

**Graph:**
- Onboarding or periodic sync: import or link VI.BE calls into `opportunity` nodes (or lightweight references).
- On application: `submitted_to` edge with rich context (which mixes, which recent performed_at venues, which agent quests were active).
- On success (manual claim or Belgium Booms export): `booked_by` + `performed_at` + `yielded_outcome`.

**Lua (new or extended Opportunity Scout agent + reuse Collab Weaver / Scene Orbit):**
- "3 calls this month where artists with similar venue triangles to you succeeded in the last 18 months."
- Draft application text that references the artist’s actual graph ("I played support at Fuse in May alongside two artists who later…").
- Pre-flight checklist: "Your current momentum (recent yielded_outcome + active quests) makes you a strong fit for this gemak! DJ Contest."

**Codex:**
- Lightweight import or webhook-friendly opportunity ingestion (respect VI.BE ToS; start with manual "add this call" + later official partnership path).
- RLS so only the artist sees their own application graph.

**Claude Code:**
- Dedicated "Opportunities" surface with agent-ranked calls + "Why you" explanations (traceable to specific edges/quests).
- Application composer that pulls live graph context and lets the user edit before submit.
- Post-application tracking that feeds the yield dashboard.

**Metrics:**
- Application volume + success rate lift for MIXHIVE users vs baseline (self-reported or via future VI.BE partnership data).
- % of applications that cite MythicNode-derived context (qualitative signal of higher quality).

### Experiment 4: Refined Lua-Powered Discovery & Scene Navigator (Music Discovery Behaviors)
**Narrative:** "Your agents don’t just react — they help you navigate the actual scene graph."
**Why now:** The 4 strategic agents + mythicTools + GraphSeedingModal are live. Time to make discovery (peers, venues, collabs) feel magical and *useful* rather than generic "people who sound like you."

**Behaviors (expand existing scene_orbit + new lightweight Discovery agents):**
- "Similar artists by venue + listener overlap" (triangle queries via 047 helpers).
- "Venues that are currently giving traction to artists at your exact career stage and genre in a 150km radius."
- Weekly "Scene Radar" digest (via on_schedule or manual): 3 new-to-you artists with provenance ("shared 2 promoters with you via performed_at edges"), 2 rising venues, 1 high-yield collab pattern.

**Safety & UX:** All surfaced as editable suggestions. No auto-follow or auto-message. Full audit trail via recommended_by_agent edges.

**Codex:** Minor expansions to mythic.graph.query surface (safe, indexed). Possibly one new read-only RPC for "scene orbit" pre-computation (cached in Redis).

**Claude Code:** Discovery tab or "Mythic Radar" widget in feed/profile. "Add to my quests" one-click from any agent suggestion.

**Metrics:** Discovery engagement (views, "added to quest", follow-through to actual follows or collabs) + downstream yield correlation.

### Experiment 5: Mythic Tour Weaver + Artist-Venue Narrative Activation (Follow-up: Artist-to-Venue Graph)
**Narrative:** "Your gigs stop being isolated dots and become chapters in a legible career story."
**Why now:** performed_at and booked_by edges + venue nodes already exist. GraphSeedingModal proves users will manually seed recent history. The yield analyst and narrator agents can now close the loop.

**Graph:**
- Strong encouragement (and agent assistance) for `performed_at` + `booked_by` + `promoter` edges during/after every gig.
- "Tour leg" as a lightweight quest or derived view over a time-bounded set of performed_at edges.
- Automatic suggestion of "next logical venue" based on shared artists who succeeded there (collab_with + performed_at triangles).

**Lua (new lightweight Tour Weaver or extension of narrator):**
- "Given your last 6 performed_at edges and the promoters who have booked 3+ artists from your current scene_orbit, here are 4 venues/promoters worth approaching in the next 90 days, with exact context for the outreach email."
- Post-gig: "Log this as a performed_at edge + link it to any active quests. This just became part of your legend."

**Codex:** Any small schema for "tour" grouping if justified (otherwise pure query + quest linkage). Easy "I played here" flow that writes the edge (mobile-friendly).

**Claude Code:** Beautiful timeline/narrative view of an artist’s venue history (the "Mythic Map"). One-tap logging from mobile or after a gig. Outreach draft generator that pulls the exact graph evidence.

**Metrics:** % of logged gigs that later correlate with new opportunities (Belgium Booms, larger festivals, label interest). Agent-driven outreach acceptance/booking rate lift.

---

## 5. Implementation Constraints & Guardrails (Non-Negotiable)

- Stay a modular monolith: Postgres system of record, Redis for cache/coordination, background workers (exact audio_jobs / mythic_graph_jobs pattern) for heavy work.
- **Always invoke the skills** for changes:
  - Schema: `/home/kilisan/dj-nef-website/mixhive/.claude/skills/mixhive-migration/SKILL.md`
  - Lua agents or tool surface: `/home/kilisan/dj-nef-website/mixhive/.claude/skills/mixhive-lua-agent/SKILL.md`
- RLS + service-role discipline: Never expose raw moderation signals, full graph internals, or private media to regular users. Agent jobs run as service role; user-facing surfaces are RLS-scoped.
- Safety & UX: No auto-posting, no external account scraping, no sending messages without explicit confirmation. Every agent recommendation must be visible, editable, and traceable (recommended_by_agent + agent_id).
- No new foundational tech in this phase (no Neo4j, no separate microservices, no paid moderation/audio APIs unless ROI is overwhelmingly clear and approved).
- Verification before any handoff: `npx tsc --noEmit`, `npm run build`, relevant smoke tests, `db:types:check` if schema touched.

---

## 6. Handoff Artifacts Required from This Agent Session

**For Codex (infra / schema / jobs / Lua surface):**
- Any proposed new migration(s) as clean SQL files following the project convention (use the migration skill).
- Exact function signatures for any new/expanded `mythic.*` tools.
- Job type definitions and enqueue/mark helper patterns (copy the 040/046 style exactly).
- Realtime channel + presence design for Experiment 1.
- RLS policy deltas (if any) + justification.

**For Claude Code (product / UI / copy):**
- Screen-by-screen or component-level flows for each experiment (states, empty states, loading, error, success).
- Exact copy tone guidelines ("career legend", "yield", "this just wrote itself into your myth", "evidence from your graph").
- Integration points into existing surfaces (dashboard, opportunities, profile, feed, agent gallery).
- Accessibility & mobile considerations (especially gig logging and opportunity applications).

**For both:**
- Success metrics definition + lightweight experiment design for each flag ship item.
- Clear "what makes this uncopyable" paragraph for every experiment.
- Updated risk / privacy notes (especially around provenance edges that could reveal sensitive career history).

---

## 7. Completion Criteria for This Phase

This phase (the agent session using *this* prompt) is complete when:

- A fresh market scan (2026) is summarized with specific competitor citations and gap analysis that directly informs the experiments.
- 4–5 well-formed flagship experiments are specified with:
  - Product narrative + "why MIXHIVE now"
  - MythicNode graph usage (deltas only)
  - Lua agent behaviors (current surface + minimal extensions)
  - Concrete Codex + Claude Code handoff artifacts
  - Success metrics + experiment design
- All 5 follow-up questions from the original Phase 6 prompt are explicitly re-answered with *current-state-aware* recommendations (architectural requirements for the live 045–047 graph, Lua behaviors for discovery, success metrics framework, real-time collab integration strategy, artist-to-venue mapping).
- The output is written as one or more files in `mixhiveresearch/` (primary: this style of engineered prompt + optional 19a market notes).
- The prompt is self-contained enough that a future Codex/Claude Code pair can execute one or more experiments with minimal re-discovery.
- Uniqueness vs 2026 competitors (BandLab/Soundtrap real-time, Venice/MNRGS/SymphonyOS career AI, Viberate, Spotify AI DJ + SongDNA, VI.BE raw infrastructure, RA/SoundCloud) is stated clearly and tied to the live shipping stack (graph + safe Lua + provenance + Belgian underground focus).

---

## 8. The 5 Original Follow-ups — Current-State Answers (Embed These)

1. **Architectural requirements for MythicNode graph storage**  
   The 045–047 design (Postgres tables + triggers + background derivation jobs + Redis caching for hot ego graphs + full traceability) is correct and live. Continue this pattern. No external graph DB in this phase. Pre-materialize hot triangles and yield summaries. Every new edge must carry source_event + optional agent_id.

2. **How to design Lua-based user agent behaviors for music discovery**  
   Use the existing wasmoon strategic agents + Lupa user agents. Give strategic agents rich read access via the growing `mythic.*` tool surface (start with the 4 existing + the minimal extensions proposed above). Keep all discovery output as *suggestions* (recommended_by_agent edges). Let power users write their own Lupa agents that react to new performed_at or yielded_outcome edges. Persona examples that work: "Scene Navigator", "Tour Weaver", "Collab Scout".

3. **Defining success metrics for MIXHIVE social feature experiments**  
   Primary north star: **attributable career yield** (number of `yielded_outcome` edges created per active user per quarter, correlated with downstream opportunity success). Leading indicators: agent suggestion acceptance rate, quest completion rate, GraphSeedingModal completion %, Mythic Session → collab edge creation rate. Instrument everything with the graph itself (the best source of truth). Build the dashboard from Experiment 2 early — it becomes the measurement system for the entire platform.

4. **Integration strategies for real-time collaborative music editing**  
   Do not build a full DAW. Layer on top of (or alongside) BandLab/Soundtrap for users who want that. For MIXHIVE-native value: start with a lightweight "Mythic Session" that uses Supabase Realtime for presence + cursors + chat, Supabase Storage for stems/assets, and writes graph edges on every meaningful save/fork. Prototype Yjs/CRDT (y-websocket + Tone.js or similar) only for the arrangement/metadata layer if conflict-free editing proves necessary for the target users. The killer feature is not the editor — it is the automatic provenance and yield linkage that no other real-time tool has.

5. **Mapping artist-to-venue graph relationships in MythicNode**  
   Already partially live (`performed_at`, `booked_by`, venue nodes, GraphSeedingModal). Double down in Experiment 5. Make logging a gig as easy as posting a buzz. Use the narrator and a new Tour Weaver agent to turn the raw edges into narrative ("Your three Fuse supports in 2026 put you in the same cohort as X and Y, both of whom later…"). This is one of the highest-leverage, lowest-competition surfaces in the entire underground electronic space.

---

**End of Prompt**

Copy everything above this line into a fresh agent session (along with the current mixhiveresearch/10–18 files, CLAUDE.md, the relevant migrations, and the live src/server/lua-agents/ + src/lib/mythic-* files) and execute.

MIXHIVE’s durable advantage is no longer theoretical. The graph and the agents are shipping. This phase is about making that advantage *obvious and irresistible* to the exact creators who treat underground electronic music as a serious craft and career.

Now go make it excel.
