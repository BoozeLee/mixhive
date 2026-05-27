# MIXHIVE AI Infrastructure Execution Plan

## Summary

Build MIXHIVE into the AI operating system for underground music culture through
four tightly sequenced pillars:

1. AI foundation and safety.
2. Creator profile, EPK, and onboarding intelligence.
3. Opportunity/collaboration matching.
4. Audio and scene intelligence.

Codex owns infrastructure, data architecture, API routes, jobs, verification,
and deployment readiness. Claude Code owns creator-facing UX, route-level
product polish, component states, interaction design, and copy. Shared files
require coordination.

## Collaboration Rules

Codex owns:

- AI API architecture and route contracts.
- Supabase schema/migrations/RLS planning.
- Background job design.
- AI key routing and cost controls.
- Smoke tests, CI, build/deploy readiness.
- Technical docs and handoff specs.

Claude Code owns:

- Profile/Settings/Onboarding UX.
- Dashboard/Agent Inbox/Opportunity UI.
- Buzz/feed/product interactions.
- Mobile layout and visual polish.
- Creator-facing copy and empty/loading/error states.
- Human approval flows for agents.

Shared:

- `src/App.tsx` route table.
- `src/lib/api.ts` client API surface.
- `src/lib/types.ts` shared types.
- `src/views/ProfileSetup.tsx` and `src/views/Settings.tsx` when AI key UX
  touches server contracts.
- Database migrations that affect product flows.

## Phase 1: AI Foundation

Goal: make the AI layer safe, observable, and extensible before adding more
features.

Codex tasks:

- Define an `ai_suggestions` persistence model for draft AI outputs.
- Define `ai_feedback` for thumbs up/down, apply/reject, comments, and outcome.
- Define `creator_tasks` for Agent Inbox cards.
- Define an `ai_embeddings` strategy using Supabase pgvector.
- Define a model-routing abstraction with task name, model, fallback, cost cap,
  and user/platform key policy.
- Add API contract docs for existing AI routes:
  - avatar generation
  - bio generation
  - genre suggestions
  - Pro art generation
- Plan optional server envs:
  - `OPENAI_API_KEY`
  - `HUGGINGFACE_API_KEY`
  - future vendor keys for audio recognition and job orchestration.
- Add smoke coverage for Settings AI anchor and future Agent Inbox route once it exists.

Claude tasks:

- Polish Settings AI key management UI.
- Add clear "AI is assistive, not autonomous" copy.
- Add a Profile Setup fallback when no AI key exists.
- Design reusable suggestion cards with apply/reject/why actions.
- Design an Agent Inbox route mock without backend dependency.

Acceptance criteria:

- AI outputs can be stored, reviewed, applied, rejected, and rated.
- No outward-facing agent action can happen without human approval.
- AI route behavior is documented and testable.
- Settings clearly explains platform key, user key, and Pro hosted AI behavior.

## Phase 2: Creator Intelligence Core

Goal: make MIXHIVE immediately useful to creators before the full graph exists.

Features:

- Profile Coach.
- EPK generator.
- Bookability/profile completeness score.
- Weekly Creator Briefing skeleton.

Codex tasks:

- Add server-side functions for profile scoring inputs.
- Add `press_kits` and public slug plan.
- Add a basic EPK generation route or server action contract.
- Add a weekly briefing job contract.
- Add tests for protected AI data access and RLS assumptions.

Claude tasks:

- Build Profile Coach panel on dashboard/profile setup.
- Build public EPK preview UI.
- Add "Generate EPK" and "Improve profile" flows.
- Add mobile states for suggestion cards.
- Create empty states for creators with no uploads, no profile image, or no goals.

Acceptance criteria:

- A creator can generate an improved bio/profile suggestion.
- A creator can generate a one-page EPK draft.
- Suggestions explain what data they used.
- Suggestions are editable before publishing.

## Phase 3: Opportunity And Collaboration Engine

Goal: ship the core differentiated wedge: "what should I do next, who should I
work with, and where should I play?"

Features:

- Opportunity feed.
- Opportunity Match Agent.
- Collaboration Match Agent.
- Booking Scout Agent.
- Venue/promoter fit score MVP.

Codex tasks:

- Define `opportunities`, `opportunity_applications`, `venues`, `promoters`,
  `collectives`, `collaborations`, `artist_goals`, `artist_skills`,
  `availability`, and `location_radius`.
- Build ingestion interface for manual/public opportunity seed data.
- Build match scoring API:
  - hard filters: deadline, location radius, role, genre.
  - semantic ranking: profile/opportunity embeddings.
  - explanation: LLM-generated rationale from score factors.
- Add feedback loop for match quality.
- Add rate limits for outreach draft generation.

Claude tasks:

- Build Opportunity Hub UI.
- Build "Why this fits" panel.
- Build collaboration match cards.
- Build booking draft review modal.
- Build profile/goals/availability capture UX.
- Build partner-facing opportunity card mock.

Acceptance criteria:

- A creator sees ranked opportunities with reasons.
- A creator can save, dismiss, or start an application draft.
- A creator can express interest in a collaborator without auto-sending spam.
- Every match can be rated for quality.

## Phase 4: Audio Intelligence MVP

Goal: make uploaded mixes more valuable and unlock graph data that competitors
do not have.

Features:

- BPM/key/mood/energy extraction.
- Mix structure summary.
- Optional tracklist recognition pipeline.
- DJ Set Analyzer card.

Codex tasks:

- Define `audio_features` and `mix_tracks`.
- Choose initial audio analysis path:
  - browser/client extraction for low-cost features, or
  - background worker for server extraction.
- Create background job contract for `mix.uploaded`.
- Store analysis status on mix records.
- Add failure states and retry policy.
- Gate expensive tracklist recognition behind Pro.

Claude tasks:

- Add upload progress states for "Analyzing mix."
- Add mix detail UI for BPM/key/mood/energy.
- Add timestamped tracklist UI.
- Add "edit/correct AI tracklist" UX.
- Add DJ Set Analyzer summary card.

Acceptance criteria:

- New uploads can enter an analysis queue.
- Mix pages can show analysis pending/failed/complete.
- Creators can correct AI-derived metadata.
- Corrected data feeds back into future matching.

## Phase 5: Scene Radar And Partner Dashboards

Goal: turn aggregated graph data into B2B and institutional value.

Features:

- Scene Radar.
- Trend digest.
- Venue/promoter dashboard.
- Aggregate-only partner insights.

Codex tasks:

- Define `trend_radar` and partner access controls.
- Build aggregation jobs for city/genre/scene trend metrics.
- Add partner role/seat model.
- Add aggregate query APIs that cannot expose private user data.

Claude tasks:

- Build Scene Radar visual UI.
- Build weekly trend digest surface.
- Build partner dashboard prototype.
- Add data privacy explanations for creators and partners.

Acceptance criteria:

- Partners can only see aggregate insights unless explicit user consent exists.
- Creators can opt into visibility for opportunity/booking discovery.
- Scene Radar shows useful trends without exposing private profiles.

## Verification Plan

Run after every phase:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run smoke -- --mock-supabase <local-preview-url>`

Add targeted tests as features land:

- AI routes reject unauthenticated requests.
- User-key routes cannot read another user key.
- Suggestions cannot be applied to another user's profile.
- Opportunity matching respects privacy and opt-in flags.
- Outreach drafts are never auto-sent.
- Mobile route smoke includes dashboard, setup, settings, opportunities, agent inbox, and mix detail.

## Immediate Next Build Slice

Recommended next slice:

1. Add persistent AI suggestion/task data model.
2. Build Agent Inbox UI skeleton.
3. Add Profile Coach suggestion flow.
4. Add manual opportunity seed table and UI.
5. Build Opportunity Match MVP with explainable ranking.

This slice proves the core thesis without requiring heavy audio processing or a
formal VI.BE partnership.

