# MIXHIVE AI Infrastructure Task + Todo List

Terminal-facing checklist derived from `07-ai-infrastructure-master-plan.md`.

Legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` complete
- Owner tags: `Codex`, `Claude`, `Shared`, `GTM`

## Guardrails

- [x] `Shared` Keep DNS/deployment separate from AI feature work unless explicitly requested.
- [x] `Shared` Keep the existing app baseline stable: Next bridge, dashboard, Buzz, Profile Setup, AI routes, mobile smoke.
- [x] `Shared` Do not add autonomous outreach.
- [ ] `Shared` Do not train generative music models on user uploads.
- [ ] `Shared` Require human approval before application, intro, booking, or outreach drafts leave MIXHIVE.
- [x] `Codex` Keep direct vector access server-only.
- [ ] `Codex` Keep private/unreleased audio excluded from partner dashboards.
- [x] `Claude` Keep all new AI surfaces consistent with the black/gold cyber-hive UI.
- [x] `Claude` Add clear loading, empty, error, and mobile states to every new AI surface.

## Phase 0: Baseline Protection

- [x] `Codex` Confirm current local baseline before AI work: `npx tsc --noEmit`.
- [x] `Codex` Confirm current local baseline before AI work: `npm run lint`.
- [x] `Codex` Confirm current local baseline before AI work: `npm run build`.
- [x] `Codex` Confirm current local baseline before AI work: local smoke with `--mock-supabase`.
- [ ] `Codex` Add/confirm feature flag strategy for new AI surfaces.
- [ ] `Codex` Document current AI route contracts: avatar, bio, genre suggestions, Pro art.
- [ ] `Claude` Review current dashboard, Buzz, Profile Setup, Settings, and mobile UX before adding new surfaces.

## Phase 1: AI Foundation And Agent Safety

### Data Models

- [x] `Codex` Add `ai_suggestions` migration.
- [x] `Codex` Add `ai_feedback` migration.
- [x] `Codex` Add `creator_tasks` migration.
- [x] `Codex` Add `recommendation_scores` migration.
- [x] `Codex` Add `ai_embeddings` migration with pgvector support.
- [x] `Codex` Add RLS for user-owned AI suggestions.
- [x] `Codex` Add RLS for user-owned AI feedback.
- [x] `Codex` Add RLS for user-owned creator tasks.
- [x] `Codex` Ensure `ai_embeddings` cannot be read directly from the client.
- [x] `Codex` Add audit fields: owner, status, source, model, version, confidence, timestamps.

### API / Client Surface

- [x] `Codex` Add shared `AiSuggestion` type.
- [x] `Codex` Add shared `AiFeedback` type.
- [x] `Codex` Add shared `CreatorTask` type.
- [x] `Codex` Add shared `RecommendationScore` type.
- [ ] `Codex` Add list/create/update AI suggestion API helpers.
- [ ] `Codex` Add apply AI suggestion API helper.
- [ ] `Codex` Add reject AI suggestion API helper.
- [ ] `Codex` Add submit AI feedback API helper.
- [ ] `Codex` Add list creator tasks API helper.
- [ ] `Codex` Add mark creator task done/dismissed API helper.
- [ ] `Codex` Add model-routing config shape with task, model, fallback, cost cap, key policy, Pro gate.

### UI

- [x] `Claude` Build reusable AI suggestion card.
- [x] `Claude` Add Apply action state.
- [x] `Claude` Add Reject action state.
- [ ] `Claude` Add Edit action state.
- [x] `Claude` Add Why/rationale action state.
- [x] `Claude` Add Rate action state.
- [x] `Claude` Build Agent Inbox skeleton route.
- [x] `Claude` Build pending suggestions section.
- [x] `Claude` Build creator tasks section.
- [ ] `Claude` Add "AI is assistive, not autonomous" trust copy.
- [ ] `Claude` Add no-AI-key fallback states in Profile Setup and Settings.

### Acceptance

- [ ] `Shared` Every AI output is stored before it affects user-facing data.
- [x] `Shared` Suggestions cannot be applied to another user's profile.
- [x] `Shared` Outbound actions are impossible without manual confirmation.
- [x] `Shared` Users can reject and rate every AI recommendation.

## Phase 2: Creator Intelligence Core

### Data / Backend

- [x] `Codex` Add `artist_goals` migration.
- [ ] `Codex` Add `artist_skills` migration.
- [ ] `Codex` Add `availability` migration.
- [ ] `Codex` Add `location_radius` migration.
- [x] `Codex` Add `press_kits` migration.
- [ ] `Codex` Add `external_links` migration if current social links are insufficient.
- [ ] `Codex` Add profile scoring inputs from profile fields, genres, uploads, links, avatar, bio, goals, activity.
- [ ] `Codex` Add Profile Coach prompt template.
- [x] `Codex` Add EPK generation route/contract.
- [ ] `Codex` Add weekly Creator Briefing job contract.
- [ ] `Codex` Add audit log for applied profile/EPK suggestions.

### UI

- [ ] `Claude` Add Profile Coach panel to dashboard.
- [ ] `Claude` Add Profile Coach panel or nudge to Profile Setup.
- [x] `Claude` Add Generate EPK flow.
- [ ] `Claude` Add Improve Profile flow.
- [ ] `Claude` Add Apply Suggestion flow.
- [x] `Claude` Add EPK preview route.
- [ ] `Claude` Add editable EPK sections.
- [x] `Claude` Add public/shareable EPK view.
- [ ] `Claude` Add empty state for missing avatar.
- [ ] `Claude` Add empty state for missing bio.
- [ ] `Claude` Add empty state for missing links.
- [ ] `Claude` Add empty state for missing genres.
- [ ] `Claude` Add empty state for missing uploads.
- [ ] `Claude` Add empty state for missing goals.

### Acceptance

- [ ] `Shared` Creator can generate profile improvement suggestions.
- [ ] `Shared` Creator can edit profile improvement suggestions.
- [x] `Shared` Creator can generate one-page EPK draft.
- [x] `Shared` EPK uses real profile data only.
- [x] `Shared` EPK does not hallucinate achievements.
- [ ] `Shared` Suggestion rationale shows what data was used.

## Phase 3: Opportunity And Collaboration Engine

### Data / Backend

- [x] `Codex` Add `opportunities` migration.
- [ ] `Codex` Add `opportunity_applications` migration.
- [ ] `Codex` Add `venues` migration.
- [ ] `Codex` Add `promoters` migration.
- [ ] `Codex` Add `collectives` migration.
- [ ] `Codex` Add `collaborations` migration.
- [ ] `Codex` Add opportunity ingestion interface for public/manual source data.
- [ ] `Codex` Seed 100 Belgian/Flemish public/manual opportunities.
- [ ] `Codex` Add profile embedding generation contract.
- [ ] `Codex` Add opportunity embedding generation contract.
- [ ] `Codex` Add opportunity scoring API with deadline filter.
- [ ] `Codex` Add opportunity scoring API with location radius filter.
- [ ] `Codex` Add opportunity scoring API with role filter.
- [ ] `Codex` Add opportunity scoring API with genre filter.
- [ ] `Codex` Add opportunity scoring API with availability filter.
- [ ] `Codex` Add opportunity scoring API with opt-in visibility filter.
- [ ] `Codex` Add explainable LLM rationale generation.
- [x] `Codex` Add opportunity save state.
- [x] `Codex` Add opportunity dismiss state.
- [x] `Codex` Add opportunity apply/draft state.
- [ ] `Codex` Add opportunity match feedback.
- [ ] `Codex` Add rate limits for application/outreach draft generation.

### UI

- [x] `Claude` Build `/opportunities` route.
- [x] `Claude` Build "For You" tab.
- [x] `Claude` Build "Saved" tab.
- [x] `Claude` Build "Applied" tab.
- [x] `Claude` Build "Dismissed" tab.
- [x] `Claude` Build opportunity cards with score.
- [x] `Claude` Add deadline display.
- [x] `Claude` Add location display.
- [x] `Claude` Add source display.
- [x] `Claude` Add compensation display.
- [x] `Claude` Add tags display.
- [x] `Claude` Add "why this fits" panel.
- [x] `Claude` Build application draft modal.
- [x] `Claude` Build human edit/approve controls.
- [ ] `Claude` Build collaboration match cards.
- [ ] `Claude` Build intro request review modal.
- [ ] `Claude` Build creator goal capture UX.
- [ ] `Claude` Build skill capture UX.
- [ ] `Claude` Build availability capture UX.
- [ ] `Claude` Build travel-radius capture UX.
- [x] `Claude` Add "MIXHIVE never contacts anyone automatically" copy.

### Acceptance

- [x] `Shared` Creator sees ranked opportunities with reasons.
- [x] `Shared` Creator can save opportunities.
- [x] `Shared` Creator can dismiss opportunities.
- [x] `Shared` Creator can start an application draft.
- [ ] `Shared` Creator can request collaborator intro.
- [ ] `Shared` Collaborator intro does not send automatically.
- [ ] `Shared` Every match collects feedback.
- [ ] `Shared` Private profile fields are not exposed to opportunity sources or partners.

## Phase 4: Audio Intelligence MVP

### Data / Backend

- [ ] `Codex` Add `audio_features` migration.
- [ ] `Codex` Add `mix_tracks` migration.
- [ ] `Codex` Add `mix_scenes` plan or migration.
- [ ] `Codex` Add `analysis_status` field/plan for mixes.
- [ ] `Codex` Choose low-cost first audio analysis path.
- [ ] `Codex` Define `mix.uploaded` background job contract.
- [ ] `Codex` Store BPM.
- [ ] `Codex` Store key/Camelot.
- [ ] `Codex` Store mood.
- [ ] `Codex` Store energy.
- [ ] `Codex` Store structure JSON.
- [ ] `Codex` Store model/source/confidence.
- [ ] `Codex` Add Pro/Quota gate for expensive tracklist recognition.
- [ ] `Codex` Add correction feedback path for AI audio metadata.

### UI

- [ ] `Claude` Add upload "Analyzing mix" state.
- [ ] `Claude` Add mix detail BPM display.
- [ ] `Claude` Add mix detail key/Camelot display.
- [ ] `Claude` Add mix detail mood display.
- [ ] `Claude` Add mix detail energy display.
- [ ] `Claude` Add timestamped tracklist display.
- [ ] `Claude` Add timestamped tracklist editor.
- [ ] `Claude` Add DJ Set Analyzer summary card.
- [ ] `Claude` Add audio analysis failure/retry messaging.

### Acceptance

- [ ] `Shared` Mix pages show analysis pending state.
- [ ] `Shared` Mix pages show analysis failed state.
- [ ] `Shared` Mix pages show analysis complete state.
- [ ] `Shared` Creator can correct AI metadata.
- [ ] `Shared` Corrected metadata feeds future matching.
- [ ] `Shared` Expensive audio processing cannot run without quota/Pro gate.

## Phase 5: Scene Radar And Partner Dashboards

### Data / Backend

- [ ] `Codex` Add `trend_radar` migration.
- [ ] `Codex` Add `verified_partners` migration.
- [ ] `Codex` Add `partner_seats` migration.
- [ ] `Codex` Add city trend aggregation job.
- [ ] `Codex` Add genre trend aggregation job.
- [ ] `Codex` Add scene trend aggregation job.
- [ ] `Codex` Add upload velocity metric.
- [ ] `Codex` Add opportunity demand metric.
- [ ] `Codex` Add engagement shift metric.
- [ ] `Codex` Build aggregate-only Scene Radar API.
- [ ] `Codex` Build partner access controls.
- [ ] `Codex` Add creator opt-in flags for opportunity/booking visibility.

### UI

- [ ] `Claude` Build Scene Radar map/list/hive graph UI.
- [ ] `Claude` Build weekly trend digest card.
- [ ] `Claude` Build partner dashboard prototype.
- [ ] `Claude` Build venue dashboard variant.
- [ ] `Claude` Build festival dashboard variant.
- [ ] `Claude` Build VI.BE-style organization dashboard variant.
- [ ] `Claude` Build radio dashboard variant.
- [ ] `Claude` Add privacy explanation copy.
- [ ] `Claude` Add creator opt-in settings.

### Acceptance

- [ ] `Shared` Partners see aggregate trends only by default.
- [ ] `Shared` Creators control discoverability.
- [ ] `Shared` Scene Radar can show Brussels/Ghent/Antwerp trend summaries without exposing private profiles.
- [ ] `Shared` Partner dashboards do not require direct table access.

## Phase 6: Belgian Pilot And GTM

### GTM Tasks

- [ ] `GTM` Recruit 10 anchor creators in weeks 1-2.
- [ ] `GTM` Recruit 50 creators across Brussels/Ghent/Antwerp by week 8.
- [ ] `GTM` Prepare free Pro offer for anchor DJs and organizers.
- [ ] `GTM` Run AI profile/EPK setup sessions.
- [ ] `GTM` Send weekly Opportunity Match reports.
- [ ] `GTM` Produce Belgian underground digest.
- [ ] `GTM` Pitch VI.BE by weeks 9-12.
- [ ] `GTM` Pitch 3 venue/festival partners by weeks 9-12.
- [ ] `GTM` Track profile completion lift.
- [ ] `GTM` Track EPKs generated.
- [ ] `GTM` Track opportunity matches rated useful.
- [ ] `GTM` Track applications started/submitted.
- [ ] `GTM` Track artist-reported time saved.
- [ ] `GTM` Track organizer-reported match quality.
- [ ] `GTM` Track anchor creator retention.

### Anchor Target List

- [ ] `GTM` Kiosk Radio.
- [ ] `GTM` Rebel Up.
- [ ] `GTM` BXL Underground.
- [ ] `GTM` Crevette Records.
- [ ] `GTM` Listen! Festival.
- [ ] `GTM` Fuse.
- [ ] `GTM` C12.
- [ ] `GTM` Ampere.
- [ ] `GTM` Kompass.
- [ ] `GTM` Chinastraat.
- [ ] `GTM` Beursschouwburg.
- [ ] `GTM` DJ schools.
- [ ] `GTM` Rehearsal spaces.

## Verification Checklist

Run after every implementation slice:

- [ ] `Codex` `npx tsc --noEmit`
- [ ] `Codex` `npm run lint`
- [ ] `Codex` `npm run build`
- [ ] `Codex` `npm run preview -- -p <port>`
- [ ] `Codex` `npm run smoke -- --mock-supabase http://127.0.0.1:<port>`

Route smoke coverage:

- [ ] `Codex` `/dashboard`
- [ ] `Codex` `/setup`
- [ ] `Codex` `/settings`
- [ ] `Codex` `/opportunities`
- [ ] `Codex` `/agents/inbox` or equivalent Agent Inbox route
- [ ] `Codex` `/mix/test-id`
- [ ] `Codex` `/buzz/test-id`
- [ ] `Codex` `/u/test-user`

Security tests:

- [ ] `Codex` AI routes reject unauthenticated requests.
- [ ] `Codex` Users cannot read another user's AI key.
- [ ] `Codex` Users cannot read another user's suggestions.
- [ ] `Codex` Users cannot read another user's tasks.
- [ ] `Codex` Users cannot read another user's EPK drafts.
- [ ] `Codex` Users cannot read another user's goals.
- [ ] `Codex` Users cannot read another user's applications.
- [ ] `Codex` Partners cannot read individual private profile data.
- [ ] `Codex` Embeddings are never directly exposed to client queries.
- [ ] `Codex` Outbound drafts are never sent automatically.
- [ ] `Codex` Private/unreleased audio never appears in partner dashboards.

Product tests:

- [ ] `Shared` Suggestion apply flow works.
- [ ] `Shared` Suggestion reject flow works.
- [ ] `Shared` Suggestion edit flow works.
- [ ] `Shared` Suggestion rate flow works.
- [ ] `Shared` Opportunity save flow works.
- [ ] `Shared` Opportunity dismiss flow works.
- [ ] `Shared` Opportunity apply flow works.
- [ ] `Shared` Application draft stays editable before use.
- [ ] `Shared` Collaboration intro requires explicit confirmation.
- [ ] `Shared` EPK uses real profile data only.
- [ ] `Shared` Mobile layouts remain stable at 320px.

## Immediate Next Slice

- [ ] `Codex` Implement `ai_suggestions`, `ai_feedback`, `creator_tasks`, `recommendation_scores`.
- [ ] `Codex` Add shared types and API helpers for suggestions/tasks/feedback.
- [ ] `Claude` Build Agent Inbox skeleton.
- [ ] `Claude` Build reusable AI suggestion card.
- [ ] `Codex` Add `artist_goals`, `artist_skills`, `availability`, `location_radius`.
- [ ] `Claude` Add goals/skills/availability/radius capture UX.
- [ ] `Codex` Add manual `opportunities` seed model.
- [ ] `Codex` Seed first Belgian/Flemish opportunities.
- [ ] `Claude` Build `/opportunities` route MVP.
- [ ] `Shared` Run full verification gate.
