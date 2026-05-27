# MIXHIVE AI Infrastructure Master Plan

## Summary

Build MIXHIVE as the AI operating system for underground music culture: a
creator-native graph connecting identity, mixes, opportunities, collaborators,
venues, fan support, booking, press kits, grants, and scene intelligence.

The first defensible wedge is not a generic AI chatbot. It is an explainable
Opportunity + Collaboration Engine supported by Profile/EPK intelligence and
later upgraded with Audio Intelligence and Scene Radar. VI.BE is the regional
benchmark and likely partner model: MIXHIVE should complement VI.BE as the AI
action layer for artists, not replace it.

Primary operating rules:

- Human-first, AI-assisted.
- No autonomous outreach.
- No generative music model training on user uploads.
- Every recommendation explains "why this fits."
- Every AI suggestion can be applied, rejected, edited, and rated.
- Private/unreleased audio and personal data stay protected by RLS and consent.
- Belgium/Flanders first; Berlin/Amsterdam later.

## Implementation Roadmap

### Phase 0: Baseline Protection

Goal: keep the existing app stable while AI infrastructure is added.

Codex:

- Keep DNS/deployment separate from AI feature work.
- Maintain passing local gates after every slice.
- Add feature flags for new AI surfaces.
- Keep AI route contracts documented.
- Guard against data leaks in Supabase RLS and server APIs.

Claude Code:

- Preserve existing dashboard, Buzz, Profile Setup, Settings, and mobile UX.
- Keep all new AI surfaces consistent with the black/gold cyber-hive UI.
- Ensure all AI actions have clear loading, empty, error, and mobile states.

Acceptance:

- Existing routes keep passing smoke tests.
- No new AI feature breaks current upload, feed, profile, dashboard, or settings flows.

### Phase 1: AI Foundation And Agent Safety

Goal: create the persistent, auditable base layer for all AI suggestions and
agents.

Codex:

- Add data models for `ai_suggestions`, `ai_feedback`, `creator_tasks`, and
  `recommendation_scores`.
- Add `ai_embeddings` using Supabase pgvector; keep direct vector access server-only.
- Add model-routing config with task name, model, fallback, cost cap,
  user/platform key policy, and Pro gating.
- Add server APIs for listing, creating, applying, rejecting, and rating AI suggestions.
- Add audit fields: owner, status, source, model, version, confidence,
  `created_at`, `applied_at`, `rejected_at`.
- Keep existing AI routes aligned: avatar, bio, genre suggestions, Pro art.

Claude Code:

- Build reusable AI suggestion cards with Apply, Reject, Edit, Why, and Rate actions.
- Build Agent Inbox skeleton for creator tasks and pending suggestions.
- Polish Settings AI key management copy and states.
- Add "AI is assistive, not autonomous" messaging.
- Add "no AI key connected" fallbacks in Profile Setup and Settings.

Interfaces:

- AI suggestion: owner profile, suggestion type, payload JSON, rationale,
  confidence, status.
- AI feedback: suggestion id, rating, comment, outcome.
- Creator task: task type, title, priority, due date, linked entity, status.

Acceptance:

- Every AI output is stored before it affects user-facing data.
- Suggestions cannot be applied to another user's profile.
- Outbound actions are impossible without manual confirmation.
- Users can reject/rate every AI recommendation.

### Phase 2: Creator Intelligence Core

Goal: deliver immediate weekly creator value before the full opportunity graph exists.

Features:

- Profile Coach.
- Bookability/profile completeness score.
- AI EPK generator.
- Weekly Creator Briefing skeleton.

Codex:

- Build profile scoring inputs from profile fields, genres, uploads, links,
  avatar, bio, goals, and activity.
- Add `press_kits` with versioned content, public slug, optional PDF URL, and view count.
- Add EPK generation route/contract using existing profile and mix data.
- Add weekly briefing job contract that can later include opportunity, collab,
  fan, and scene signals.
- Add safe prompt templates for profile improvement and press-kit generation.

Claude Code:

- Add Profile Coach panel to dashboard and/or profile setup.
- Add EPK preview and edit UI.
- Add "Generate EPK," "Improve profile," and "Apply suggestion" flows.
- Add profile empty states for missing avatar, bio, links, genres, uploads, goals.
- Make EPK mobile-responsive and shareable.

Acceptance:

- A creator can generate and edit profile improvement suggestions.
- A creator can generate a one-page EPK draft.
- EPK output uses real profile data only and does not hallucinate achievements.
- Suggestion rationale shows what data was used.

### Phase 3: Opportunity And Collaboration Engine

Goal: ship the core differentiated product: "what should I do next, who should
I work with, and where should I play?"

Features:

- Opportunity Hub.
- Opportunity Match Agent.
- Collaboration Match Agent.
- Booking Scout Agent.
- Venue/promoter fit MVP.
- Human-reviewed application/outreach drafts.

Codex:

- Add tables for `artist_goals`, `artist_skills`, `availability`,
  `location_radius`, `opportunities`, `opportunity_applications`, `venues`,
  `promoters`, `collectives`, and `collaborations`.
- Seed 100 hand-curated Belgian/Flemish opportunities from public/manual sources.
- Add opportunity ingestion interface for VI.BE-style public calls, grants,
  contests, gigs, residencies, and festivals.
- Generate embeddings for profiles and opportunities.
- Build scoring API with hard filters: deadline, location radius, role, genre,
  availability, opt-in visibility.
- Add semantic ranking with explainable LLM rationale.
- Add save, dismiss, apply, draft, and feedback states.
- Add rate limits for draft application/outreach generation.

Claude Code:

- Build `/opportunities` route.
- Build "For You," "Saved," "Applied," and "Dismissed" tabs.
- Build opportunity cards with score, deadline, location, source,
  compensation, tags, and "why this fits."
- Build application draft modal with human edit/approve.
- Build collaboration match cards and intro request review modal.
- Build goal, skill, availability, and travel-radius capture UX.
- Add safety copy: "MIXHIVE never contacts anyone automatically."

Acceptance:

- A creator sees ranked opportunities with reasons.
- A creator can save/dismiss/start an application draft.
- A creator can request a collaborator intro, but nothing sends automatically.
- Every match collects feedback.
- Private profile fields are not exposed to opportunity sources or partners.

### Phase 4: Audio Intelligence MVP

Goal: make uploaded mixes more useful and create a data moat competitors do not have.

Features:

- BPM/key/mood/energy extraction.
- Mix structure summary.
- Optional timestamped tracklist recognition.
- DJ Set Analyzer card.
- Correctable AI metadata.

Codex:

- Add `audio_features` and `mix_tracks`.
- Add `analysis_status` for mixes: pending, processing, complete, failed.
- Choose low-cost first path: client-side or lightweight worker audio analysis
  before GPU-heavy processing.
- Define `mix.uploaded` background job contract.
- Store BPM, key, mood, energy, structure JSON, model/source, confidence.
- Gate expensive tracklist recognition and future stem separation behind Pro.
- Add correction feedback so user edits improve future matching.

Claude Code:

- Add upload states for "Analyzing mix."
- Add mix detail UI for BPM/key/mood/energy.
- Add timestamped tracklist display and editor.
- Add DJ Set Analyzer summary card.
- Add failure/retry messaging.

Acceptance:

- Mix pages show analysis pending/failed/complete.
- AI metadata can be corrected by the creator.
- Corrected metadata feeds profile, opportunity, and scene matching.
- Expensive audio processing cannot run without quota/Pro gating.

### Phase 5: Scene Radar And Partner Dashboards

Goal: turn aggregate graph data into B2B and institutional value.

Features:

- Scene Radar.
- Belgian underground digest.
- Partner dashboard prototype.
- Aggregate venue/promoter/institution insights.

Codex:

- Add `trend_radar`, `verified_partners`, and `partner_seats`.
- Add aggregation jobs for city, genre, scene, upload velocity, opportunity
  demand, and engagement shifts.
- Build aggregate-only APIs that cannot expose private individual data.
- Add creator opt-in flags for opportunity/booking visibility.
- Add partner access controls.

Claude Code:

- Build Scene Radar UI as map/list/hive graph.
- Build weekly trend digest card.
- Build partner dashboard prototype for venues, festivals, VI.BE-style orgs, and radio.
- Add privacy explanations and opt-in settings.

Acceptance:

- Partners see aggregate trends only by default.
- Creators control discoverability.
- Scene Radar can show Brussels/Ghent/Antwerp trend summaries without exposing private profiles.
- Partner dashboards are usable without giving partners direct table access.

### Phase 6: Belgian Pilot And GTM

Goal: validate MIXHIVE as trusted Belgian/Flemish underground infrastructure.

Initial cities:

- Brussels.
- Ghent.
- Antwerp.
- Leuven.
- Liege/Charleroi as secondary Wallonia bridge.

Anchor targets:

- Kiosk Radio.
- Rebel Up.
- BXL Underground.
- Crevette Records.
- Listen! Festival.
- Fuse.
- C12.
- Ampere.
- Kompass.
- Chinastraat.
- Beursschouwburg.
- DJ schools and rehearsal spaces.

Pilot:

- Recruit 10 anchor creators in weeks 1-2.
- Recruit 50 creators across Brussels/Ghent/Antwerp by week 8.
- Seed 100 Belgian/Flemish public opportunities.
- Offer free Pro to anchor DJs and organizers.
- Run AI profile/EPK setup sessions.
- Send weekly Opportunity Match reports.
- Produce a Belgian underground digest.
- Pitch VI.BE and 3 venue/festival partners by weeks 9-12.

VI.BE pitch:

- MIXHIVE does not replace VI.BE.
- MIXHIVE adds an AI action layer for better opportunity matching, profile
  quality, application preparation, and scene understanding.
- Pilot with 20-50 opted-in artists.
- Use public or consent-based data only.
- Report aggregate results.

Pilot success metrics:

- Profile completion lift.
- EPKs generated.
- Opportunity matches rated useful.
- Applications started/submitted.
- Artist-reported time saved.
- Organizer-reported match quality.
- Anchor creator retention.

## Codex / Claude Ownership

Codex owns:

- AI schemas, migrations, RLS, APIs, route contracts.
- AI key routing, quotas, model routing, cost caps.
- pgvector and matching logic.
- Job orchestration contracts.
- Smoke tests, CI, build/deploy readiness.
- Security, privacy, and technical documentation.

Claude Code owns:

- Agent Inbox UI.
- Profile Coach UX.
- EPK UX.
- Opportunity Hub.
- Collaboration/booking review flows.
- Dashboard panels and mobile polish.
- Creator-facing copy, trust messaging, and visual design.
- Loading, empty, error, and approval states.

Shared files require coordination:

- `src/App.tsx`.
- `src/lib/api.ts`.
- `src/lib/types.ts`.
- `src/views/ProfileSetup.tsx`.
- `src/views/Settings.tsx`.
- Supabase migrations that affect product behavior.

## Public APIs, Interfaces, And Data Additions

Add these capability groups incrementally, not as one giant release:

- AI review layer: `ai_suggestions`, `ai_feedback`, `creator_tasks`.
- Graph layer: `artist_goals`, `artist_skills`, `availability`, `location_radius`.
- Opportunity layer: `opportunities`, `opportunity_applications`.
- Live ecosystem: `venues`, `promoters`, `collectives`, `events`, `booking_history`.
- Matching layer: `ai_embeddings`, `recommendation_scores`.
- EPK layer: `press_kits`, `external_links`.
- Audio layer: `audio_features`, `mix_tracks`.
- Partner layer: `verified_partners`, `partner_seats`, `trend_radar`.

Minimum route/API surfaces:

- Agent Inbox route.
- Opportunity Hub route.
- EPK preview/public route.
- AI suggestion API.
- Opportunity match API.
- Application draft API.
- Collaboration match API.
- Audio analysis status API.
- Scene Radar aggregate API.

## Testing And Verification

Run after every implementation slice:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run smoke -- --mock-supabase <local-preview-url>`

Add route smoke coverage for:

- `/dashboard`
- `/setup`
- `/settings`
- `/opportunities`
- `/agents/inbox` or equivalent Agent Inbox route
- `/mix/test-id`
- `/buzz/test-id`
- `/u/test-user`

Security tests:

- AI routes reject unauthenticated requests.
- Users cannot read another user's AI key, suggestions, tasks, EPK drafts,
  goals, or applications.
- Partners cannot read individual private profile data.
- Embeddings are never directly exposed to client queries.
- Outbound drafts are never sent automatically.
- Private/unreleased audio never appears in partner dashboards.

Product tests:

- Suggestion apply/reject/edit/rate flows.
- Opportunity save/dismiss/apply flow.
- Application draft stays editable before use.
- Collaboration intro requires explicit confirmation.
- EPK uses real profile data only.
- Mobile layouts remain stable at 320px.

## Strategic Product Direction

MIXHIVE positioning:

- "The AI manager and opportunity network underground music never had."
- Human-first, AI-assisted.
- Not a DAW, not ticketing, not streaming, not crypto-first, not generative music-first.
- Designed for DJs, producers, visual artists, promoters, collectives, venues,
  festivals, labels, radio, and local music institutions.

Core product loops:

- Creator joins -> profile/onboarding intelligence improves identity.
- Creator uploads mix -> audio intelligence enriches metadata.
- Creator sets goals/skills/location -> opportunity and collaboration graph activates.
- AI suggests opportunities/collaborators/venues -> creator reviews and acts.
- Creator rates suggestions/outcomes -> graph improves.
- Aggregated activity powers Scene Radar and partner dashboards.

Primary launch geography:

- Brussels, Ghent, Antwerp, Leuven first.
- Liege/Charleroi as secondary bridge.
- Berlin and Amsterdam only after Belgian wedge is proven.

VI.BE strategy:

- Treat VI.BE as benchmark and potential partner, not competitor.
- Start with public or manually seeded opportunities.
- Pilot with 20-50 opted-in creators.
- Output: weekly AI opportunity report, profile/EPK support, match feedback,
  aggregate-only results.

## Agent System

MVP agents:

- Profile Coach: suggests profile improvements.
- Press Kit Agent: generates EPK draft.
- Opportunity Match: ranks gigs/grants/calls.
- Collaboration Match: suggests compatible creators.
- Booking Scout: suggests venues/promoters and drafts outreach.
- DJ Set Analyzer: summarizes mix metadata.
- Scene Radar: summarizes local scene movement.
- Fan Insights: summarizes audience/activity.
- Moderation Agent: flags spam/abuse.
- Notification Prioritizer: reduces noise.

Advanced agents:

- Grant Assistant.
- Release Strategy.
- Venue Fit.
- Label/Collective Scout.
- Visual Identity.
- Community Manager.
- Trend Intelligence.
- Event Organizer.

Agent rules:

- Each agent has explicit allowed tools.
- Each agent writes to `ai_suggestions` or `creator_tasks`.
- Each outward action requires manual approval.
- Each suggestion stores feedback and final outcome.
- Each agent has failure state and retry policy.

## Build Sequence

### 90 Days

Weeks 1-2:

- Add AI suggestion/task/feedback schema.
- Add Agent Inbox skeleton.
- Add feature flags.
- Seed 100 opportunities manually.
- Recruit 10 anchor creators.
- Produce first Belgian underground opportunity digest.

Weeks 3-4:

- Ship Profile Coach MVP.
- Ship EPK draft MVP.
- Add creator goals/skills/location/availability capture.
- Collect before/after profile examples.
- Prepare VI.BE pitch deck from real examples.

Weeks 5-8:

- Ship `/opportunities`.
- Ship ranked Opportunity Match with reasons.
- Add save/dismiss/apply statuses.
- Add application draft modal.
- Recruit 50 creators across Brussels, Ghent, Antwerp.
- Start weekly Scene Radar digest manually or semi-automated.

Weeks 9-12:

- Add Collaboration Match.
- Add Booking Scout draft flow.
- Add venue/promoter fit MVP.
- Pitch VI.BE and 3 venue/festival/radio partners.
- Run informal or co-branded pilot.
- Publish first "State of Belgian Underground" report.

### 6 Months

Month 1:

- AI foundation, suggestion/task persistence, Agent Inbox, model routing, cost caps.

Month 2:

- Creator onboarding improvements, Profile Coach, EPK generator, structured
  goals/skills/location.

Month 3:

- Opportunity seed dataset, Opportunity Hub, explainable matching, feedback loop.

Month 4:

- Collaboration Match, Booking Scout, venue/promoter fit, human-approved outreach drafts.

Month 5:

- Audio Intelligence MVP: BPM/key/mood/energy, DJ Set Analyzer, mix analysis states.

Month 6:

- Grant Assistant MVP, weekly Creator Briefing, Scene Radar digest, Belgian pilot reporting.

### 12 Months

Months 7-8:

- Full Agent Inbox, agent toggles, reusable agent presets, richer opportunity/applications workflow.

Month 9:

- Partner dashboard alpha for VI.BE-style institutions, venues, festivals, and radio.

Month 10:

- Belgian public launch event with anchor creators and local scene partners.

Month 11:

- Berlin/Amsterdam validation only after Belgian traction.

Month 12:

- First public underground intelligence report and partner case studies.

## GTM And Partnership Plan

Initial launch targets:

- Kiosk Radio.
- Rebel Up.
- BXL Underground.
- Crevette Records.
- Listen! Festival.
- Fuse.
- C12.
- Ampere.
- Kompass.
- Chinastraat.
- Beursschouwburg.
- Local DJ schools.
- Rehearsal spaces.

Pilot offer:

- Free Pro for anchor DJs and organizers.
- Profile/EPK setup sessions.
- Weekly Opportunity Match report.
- Belgian Scene Radar digest.
- Partner dashboard demos.

VI.BE pitch:

> MIXHIVE does not replace VI.BE. MIXHIVE adds an AI action layer that helps
> artists find the right opportunities faster, prepare stronger applications,
> improve their profiles, and understand their scene.

Partner success metrics:

- Profile completion lift.
- Opportunity match usefulness score.
- Applications started.
- Applications submitted.
- Artist-reported time saved.
- Organizer-reported match quality.
- Partner dashboard interest.
- Pilot conversion to public case study.

## Risks And Mitigations

Copyright/audio risk:

- Do not train generative music models on uploads.
- Require explicit opt-in for advanced audio processing.
- Keep AI copyright language as risk assistance, not legal advice.

Spam/outreach risk:

- Never auto-send.
- Add rate limits.
- Human approval for intros, booking drafts, and applications.

AI hallucination risk:

- Use source-bound prompts for grants/opportunities.
- Store confidence and rationale.
- Require user review before publishing/applying.

Privacy/GDPR risk:

- RLS on all user-owned data.
- Aggregate-only partner dashboards by default.
- Consent flags for discovery/booking visibility.
- Deletion/export must remain possible.

Cost risk:

- Use pgvector first.
- Use cheap models first.
- Cache and batch.
- Gate expensive audio/image/agent workflows behind Pro.
- Support user-supplied keys for heavy use.

Scope risk:

- Do not build DAW, ticketing, streaming replacement, crypto-first features, or
  generative music AI in the first year.
- Keep the first proof focused on creator identity, opportunities,
  collaboration, and explainable action.

## Assumptions And Defaults

- Supabase remains the system of record.
- pgvector is the default vector layer until scale proves otherwise.
- Belgian/Flemish launch comes before international expansion.
- VI.BE is treated as partner/reference, not competitor.
- Heavy audio recognition and stem separation are Pro or later-stage features.
- Claude Code handles product/UI polish.
- Codex handles infrastructure/API/schema/verification.
- DNS/deployment work remains separate from AI infrastructure unless explicitly requested.
- The next implementation slice should be AI suggestions/tasks + Agent Inbox +
  Profile Coach + seeded Opportunity Match MVP.
