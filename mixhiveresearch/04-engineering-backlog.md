# MIXHIVE AI Engineering Backlog

## Phase 0: Baseline Protection

- Keep DNS/deployment separate from AI infrastructure work.
- Keep local verification passing before and after each slice.
- Do not add autonomous outreach.
- Do not train generative music models on user content.
- Add feature flags for new AI surfaces.

## Phase 1: Data And API Foundation

Codex:

- Draft migration for `ai_suggestions`.
- Draft migration for `ai_feedback`.
- Draft migration for `creator_tasks`.
- Draft migration for `artist_goals`.
- Draft migration for `artist_skills`.
- Draft migration for `availability`.
- Draft migration for `location_radius`.
- Draft migration for `opportunities`.
- Draft migration for `opportunity_applications`.
- Draft migration for `venues`.
- Draft migration for `promoters`.
- Draft migration for `collaborations`.
- Draft migration for `ai_embeddings`.
- Add RLS policies for all user-owned tables.
- Add server APIs for create/list/update suggestion status.
- Add server APIs for opportunity ingestion and matching.
- Add cost-cap and model-routing config structure.

Claude:

- Design Agent Inbox cards.
- Design suggestion apply/reject UI.
- Design creator goal capture UI.
- Design opportunity cards.
- Design explainability panel.
- Design "AI confidence" visual language.

## Phase 2: Profile Coach And EPK

Codex:

- Add profile score calculation endpoint.
- Add profile improvement prompt.
- Add EPK generation contract.
- Add EPK storage/public slug plan.
- Add audit log for applied suggestions.

Claude:

- Add dashboard "Profile Coach" panel.
- Add Settings/Profile Setup AI nudge states.
- Add EPK preview route.
- Add editable EPK sections.
- Add mobile responsive EPK preview.

## Phase 3: Opportunity Engine

Codex:

- Seed 100 public/manual opportunities.
- Add embedding generation for opportunities.
- Add profile/opportunity scoring.
- Add rationale generation.
- Add match feedback persistence.
- Add saved/dismissed/application statuses.

Claude:

- Build `/opportunities` route.
- Build "For you" opportunity tab.
- Build "Saved" and "Applied" states.
- Build application draft modal.
- Build "Why this fits" breakdown.

## Phase 4: Collaboration And Booking

Codex:

- Add collaboration matching API.
- Add venue/promoter data structures.
- Add venue fit scoring.
- Add rate limits for draft outreach.
- Add opt-in visibility flags.

Claude:

- Build collaboration cards.
- Build intro request review modal.
- Build venue fit card.
- Build booking outreach draft UI.
- Add "do not contact automatically" safety copy.

## Phase 5: Audio Intelligence

Codex:

- Pick first audio analysis engine.
- Add `audio_features`.
- Add `mix_tracks`.
- Add background job contract.
- Add upload analysis status.
- Add Pro gating for expensive jobs.

Claude:

- Add "Analyzing" states to upload and mix detail.
- Add BPM/key/mood/energy display.
- Add timestamped tracklist editor.
- Add DJ Set Analyzer card.
- Add corrected metadata UI.

## Phase 6: Scene Radar

Codex:

- Add trend aggregation jobs.
- Add partner role model.
- Add aggregate-only dashboard APIs.
- Add privacy and consent controls.

Claude:

- Build Scene Radar map/list UI.
- Build partner dashboard prototype.
- Build weekly digest card.
- Build creator consent settings.

## Acceptance Gates

- Local static gates pass.
- Browser smoke passes down to 320px.
- Every AI output has an owner, status, model, and created timestamp.
- Every AI suggestion can be rejected.
- Every recommendation has an explanation.
- Every outbound action requires manual confirmation.
- Private/unreleased audio is never surfaced to other users or partners.

