# MIXHIVE AI Infrastructure Blueprint

## Architecture Thesis

MIXHIVE AI should be modular, explainable, approval-gated, and scene-aware. The
system should use one shared creator graph, one recommendation layer, one
moderation/safety layer, and multiple specialist agents on top.

Core principles:

- Assist human creators; do not replace them.
- Never auto-send outreach without user approval.
- Keep derived AI outputs separate from source-of-truth user data.
- Explain every recommendation with "why this fits."
- Store feedback on every suggestion.
- Respect GDPR, consent, private/unreleased audio, and partner boundaries.
- Use affordable client-side/audio preprocessing first; gate expensive GPU work.

## MVP AI Capabilities

| Capability | User problem | MVP behavior | Advanced behavior |
| --- | --- | --- | --- |
| AI onboarding | Users do not know how to set up strong profiles | Guided 8-12 question setup with generated profile draft | Link import from SoundCloud, Bandcamp, RA, Mixcloud |
| Profile optimization | Weak profiles reduce discovery | Bookability/profile completeness suggestions | A/B optimization loops and promoter-response simulation |
| Bio generation | Artists need bios fast | Tone-aware bio drafts | Multilingual, scene-specific, constantly refreshed bios |
| Avatar/art generation | Need visual identity | Static avatar/artwork generation | Full visual identity packs and event posters |
| Genre/scene classification | Bad self-tagging hurts matching | Suggested genres/scenes from profile/audio | Local micro-scene clustering |
| Opportunity matching | Artists miss calls/gigs/grants | Ranked opportunities with reasons | Fit prediction and application planning |
| Collaboration matching | Creators need compatible partners | Suggested collaborators by skill/location/scene | Audio-vector and complementary-skill matching |
| Press kit generation | EPKs are slow/outdated | One-page public EPK | Dynamic PDF/web EPK with analytics and languages |
| Booking scout | Artists need venues/promoters | Venue shortlist and outreach drafts | Routing, fit scoring, relationship memory |
| Mix intelligence | Long mixes lack useful metadata | BPM/key/mood/energy and basic structure | Tracklist recognition, chapters, set summaries |
| Fan insights | Artists do not understand audience | Basic weekly fan/activity summary | Fan cohorts, campaign suggestions, conversion paths |
| Moderation/safety | Communities attract abuse/spam | Flag queue and spam detection | Pattern detection and appeal workflows |
| Grant assistant | Funding applications are hard | Draft answers from user profile and opportunity text | Source-backed application workspace |
| Scene radar | Scenes are hard to see | Weekly local trend digest | Live heatmaps and institutional dashboards |

## Agent System

Agents should be implemented as task-specific workers with explicit inputs,
outputs, tool permissions, and human approval requirements.

| Agent | Purpose | Trigger | MVP output | Approval |
| --- | --- | --- | --- | --- |
| Profile Coach | Improve profile quality | Onboarding, profile edit, weekly scan | Suggested bio/tags/profile fixes | Apply manually |
| Opportunity Match | Match gigs/grants/calls | Daily opportunity refresh | Ranked matches and reasons | Optional |
| Booking Scout | Find venues/events | Weekly or user request | Venue shortlist and outreach draft | Required before outreach |
| Collaboration Match | Find collaborators | Weekly or "looking for" signal | Suggested creators and intro draft | Required before intro |
| Press Kit Agent | Build EPK | User request/profile milestone | Public EPK draft/PDF | Required before publish |
| Grant Assistant | Draft applications | Opportunity selected | Draft answer sections | Required |
| DJ Set Analyzer | Analyze uploaded mixes | Upload processed | BPM/key/mood/energy/tracklist summary | None for metadata, approval for publish |
| Scene Radar | Detect scene movement | Scheduled aggregation | City/scene trend brief | None |
| Fan Insights | Summarize audience | Weekly | Audience segments and actions | None |
| Visual Identity | Generate visual assets | User request/upload | Avatar/cover/poster options | Required |
| Moderation Agent | Detect abuse/spam | New post/comment/upload | Flag/action recommendation | Required for enforcement |
| Notification Prioritizer | Reduce noise | Ongoing | Ranked notifications/digest | None |

## Data Architecture

Recommended new data domains:

- `artist_goals`: growth goals, target geography, urgency.
- `artist_skills`: skills, level, proof/evidence.
- `availability`: dates, collaboration capacity, booking windows.
- `location_radius`: base city and travel radius.
- `genres` and `scenes`: taxonomy and local scene graph.
- `profile_scenes` and `mix_scenes`: scene affinity/confidence.
- `opportunities`: gigs, grants, contests, open calls, residencies.
- `opportunity_applications`: drafts, status, outcomes.
- `venues`, `promoters`, `collectives`, `events`: live ecosystem graph.
- `collaborations`: initiated/accepted/completed project states.
- `ai_embeddings`: vectors for profiles, mixes, opportunities, venues.
- `recommendation_scores`: score, rationale, model, version.
- `ai_suggestions`: pending/applied/rejected suggestions.
- `ai_feedback`: thumbs up/down, comments, outcome signal.
- `moderation_signals`: safety flags and enforcement history.
- `creator_tasks`: task queue surfaced in Agent Inbox.
- `press_kits`: EPK content, public slug, version, PDF URL.
- `booking_history`: past gigs, venues, source of truth.
- `external_links`: SoundCloud/Bandcamp/Mixcloud/RA/Spotify/etc.
- `verified_partners` and `partner_seats`: B2B partner access.
- `mix_tracks` and `audio_features`: tracklist and audio intelligence.
- `trend_radar`: generated scene trend metrics.

Security requirements:

- RLS on all user-owned and partner-scoped tables.
- `ai_embeddings` should not be directly exposed to clients.
- Similarity search should happen through server RPC/API endpoints.
- Private/unreleased audio must stay private by default.
- Agent actions must be auditable.
- External partner dashboards should use aggregate-only data unless explicit
  user consent exists.

## Technical Stack Recommendation

MVP stack:

- Next.js + Supabase remains the system of record.
- Supabase pgvector for embeddings and similarity search.
- OpenAI-compatible routes for text generation and embeddings.
- Anthropic/Gemini/OpenAI model routing later through a gateway.
- Hugging Face/Replicate/Stability-style image generation behind server routes.
- Essentia.js or similar for low-cost audio feature extraction.
- Trigger.dev or Inngest for background jobs.
- Supabase Storage for audio, images, derived assets, and EPK PDFs.
- Resend or similar for weekly creator briefings.

Scale-up stack:

- Dedicated GPU workers for long-running audio jobs such as source separation.
- Audio recognition vendors for long mix tracklisting.
- Model routing gateway with cost caps.
- Analytics warehouse if event volume outgrows Postgres reporting.
- Optional external vector DB only if pgvector scale becomes insufficient.

## Cost-Control Strategy

- Cheap classifiers first, premium models only for high-value drafting/reasoning.
- Cache generated suggestions and embeddings.
- Batch embeddings and audio jobs.
- Hard per-user AI quotas.
- Pro gating for expensive audio recognition, image generation, and long-running
  agents.
- User-supplied key option for heavy users.

