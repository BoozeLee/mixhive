# MIXHIVE Research Library

This folder stores the current research and implementation planning for the
MIXHIVE AI infrastructure push.

## Files

- `01-research-synthesis.md` - distilled market, VI.BE, partner, and competitor research.
- `02-ai-infrastructure-blueprint.md` - proposed AI architecture, agents, data model, and stack.
- `03-codex-claude-execution-plan.md` - detailed dual-agent build plan for Codex and Claude Code.
- `04-engineering-backlog.md` - implementation backlog grouped by phase and owner.
- `05-partnership-and-gtm-plan.md` - VI.BE-first Belgian launch strategy and partnership pitches.
- `06-source-research-archive.md` - preserved source-report conclusions and decision trail.
- `07-ai-infrastructure-master-plan.md` - canonical all-inclusive implementation plan.
- `08-ai-infrastructure-task-todo.md` - terminal-facing phase, owner, and verification checklist.
- `09-strategic-intelligence-report-execution-notes.md` - execution notes from the 27 May 2026 strategic intelligence report.
- `10-social-platform-scale-architecture.md` - next-phase social architecture plan for data, realtime, media, security, observability, and service boundaries.
- `11-mythicnode-mixhive-strategy.md` - Phase 6 market scan, gap analysis, and MythicNode positioning.
- `12-mythicnode-feature-specs.md` - MythicNode vocabulary + 4 flagship feature specs (Quests, Collab Web, Career Narrator, Attribution).
- `13-mythicnode-graph-and-agent-api.md` - Concrete Postgres schema, derivation strategy, extended Lua API surface, and Codex contracts.
- `14-mythicnode-followups.md` - Direct answers to architectural, Lua behavior, metrics, collab integration, and artist-venue mapping questions.
- `15-mythic-quest-lines-prd.md` - Detailed product requirements document for Mythic Quest Lines (the flagship narrative feature), grounded in migrations 045 + 046.
- `16-mythic-strategic-agents-gallery-spec.md` - UI + integration spec for surfacing the four Mythic strategic (wasmoon) agents in the Agent Gallery and Agents experience.
- `17-mythic-graph-seeding-onboarding-prd.md` - Detailed PRD for the critical graph seeding / "Tell us about your recent gigs" onboarding flow that bootstraps the MythicNode for new users.
- `18-mythic-metrics-dashboard-spec.md` - Comprehensive spec for the Mythic Metrics / Yield Attribution dashboard — the capstone surface that makes the entire graph and agent system feel valuable and trustworthy.

## Phase 6 Implementation Artifacts
- `supabase/migrations/045_mythicnode_graph.sql` — Foundational tables (`mythic_nodes`, `mythic_edges`, `quests`, `quest_milestones`) + RLS + basic helper.
- `supabase/migrations/046_mythicnode_derivation_and_jobs.sql` — Job queue (`mythic_graph_jobs`), enqueue/mark functions, lightweight derivation helpers, and first automatic triggers.
- Worker foundation: `src/lib/mythic-graph-processing.ts` + integration into `job-processor.ts`. The background worker can now execute mythic graph jobs.

## Current Thesis

MIXHIVE should become the AI operating system for underground music culture:
identity, opportunity, collaboration, booking, fan support, audio intelligence,
and scene intelligence in one creator-native graph.
