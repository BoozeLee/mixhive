# Source Research Archive

This file preserves the major source reports and conclusions that fed the
MIXHIVE AI infrastructure plan. It is intentionally structured as research
notes, not implementation instructions.

## Report 1: AI Operating System Thesis

Core claim:

MIXHIVE should be built as the AI operating system for underground music
culture: a graph of identity, opportunity, collaboration, booking, fan support,
and scene intelligence.

Key findings:

- The clearest wedge is weekly creator utility.
- Repeated workflows matter more than novelty AI.
- Highest-value workflows:
  - finding opportunities
  - improving profiles
  - matching collaborators
  - preparing releases
  - understanding where scenes are moving
- VI.BE is the strongest regional benchmark because it behaves as trusted music
  infrastructure, not just a content platform.
- MIXHIVE should complement VI.BE by adding:
  - living social graph
  - collaboration matching
  - AI-generated profile/press-kit assets
  - fan and scene intelligence
  - workflow automation

Recommended first wedge:

Build the opportunity and collaboration engine first because it aligns with
VI.BE-style infrastructure and creates a defensible graph.

## Report 2: Executive Research Validation

Core claim:

The blueprint is strategically sound. VI.BE is an ideal partner/reference model
because it combines opportunity access, trusted public support, and local music
ecosystem coordination.

Validated observations:

- VI.BE connects large numbers of young bands, DJs, and producers with
  organizers and opportunities.
- VI.BE programs such as Sound Track, Lokale Helden, Stoemp!, Popraad, MIA's,
  Belgian Music Week, and Belgium Booms create a rich ecosystem calendar.
- Most current music platforms still lack:
  - deep scene graphs
  - complementary collaborator matching
  - venue-fit scoring
  - agentic workflows for underground creators
  - trustworthy AI support for opportunity applications

Recommended first moves:

- Implement a unified creator graph.
- Ingest VI.BE-compatible opportunities.
- Add explainable recommendation logic.
- Build Brussels/Antwerp/Ghent scene validation.
- Establish ethics and approval guidelines early.

## Report 3: Strategic Architecture And Market Analysis

Core claim:

MIXHIVE can become a cultural operating system by combining vector search,
audio intelligence, background AI workflows, and Belgian/Flemish ecosystem
partnerships.

Technical ideas:

- Supabase pgvector for semantic matching.
- Client-side or worker-based audio feature extraction.
- Optional Demucs/stem separation as an advanced Pro feature.
- Trigger.dev/Inngest for long-running agent jobs.
- Human approval layer for all outward-facing actions.
- Separate AI outputs from source-of-truth user data.

Killer feature candidates:

- Stem-Split Collab Engine.
- Blind Audio Matchmaking.
- Gig Probability Scoring.
- AI-Generated Scene Naming.
- Proactive Grant Drafting.
- Vibe-Based Continuous Mixes.
- Dynamic Collaboration Bounties.
- Venue Sonic Fingerprints.
- Historical Scene Lineage.
- Anti-Mainstream Filter.

Risk notes:

- Copyright and audio processing risk require explicit user consent.
- GPU costs require Pro gating and quotas.
- Algorithmic bias must be mitigated with discovery/entropy controls.

## Report 4: Execution Synthesis

Core claim:

The breakthrough is a connective intelligence layer, not a single feature.
MIXHIVE should transform static opportunity lists into active, personalized,
explainable creator workflows.

Recommended sprint sequence:

1. VI.BE proof-of-concept.
   - Public opportunities only.
   - Offline report or internal prototype.
   - Ranked opportunity list with "why this fits."

2. Creator intelligence core.
   - AI profile and EPK autopilot.
   - Structured onboarding questions.
   - Collaboration Match MVP.

3. Actionable insight engine.
   - Where Should I Play scout.
   - Weekly Creator Briefing.
   - One collaboration, one opportunity, one scene signal, one next action.

Trust mechanism:

- Every message, intro, booking pitch, or application must be human-triggered
  and reviewed before sending.

## Report 5: Strategic Intelligence Report

Core claim:

MIXHIVE should become the AI manager and opportunity engine for underground DJs
that VI.BE does not have and SoundCloud/RA will not build.

Highest-priority MVP surfaces:

1. AI Mix Intelligence.
   - auto-tracklist
   - BPM/key/mood/scene tagging
   - waveform/structure intelligence

2. Opportunity Match Engine.
   - pgvector
   - curated opportunity feed
   - VI.BE/RA/Bandsintown/grants/event sources

3. Press Kit + Booking Outreach Agent.
   - generated EPK
   - targeted drafts
   - grant templates
   - human approval

Launch recommendation:

- Start Ghent/Brussels/Antwerp.
- Use Belgium as deep wedge before Berlin/Amsterdam.
- Recruit anchor DJs and collectives.
- Build VI.BE and Kiosk-style credibility.

Important "do not build first" notes:

- Do not build a DAW first.
- Do not build ticketing first.
- Do not build a streaming service first.
- Do not build generative music AI first.
- Do not go crypto-first.
- Do not expand outside Belgium before the first local wedge is proven.

## Report 6: General Research And Product Architecture

Core claim:

MIXHIVE sits at the intersection of social networking, live-event promotion,
music collaboration, and creative tooling. Its strongest differentiation is
AI-driven personalization and networking for DJ/underground culture.

Important platform references:

- SoundCloud for audio-social uploads.
- Bandsintown/Songkick for event discovery.
- BandLab/Soundtrap/Kompoz for collaboration and creation.
- ReverbNation for artist tools.
- Mixcloud for DJ mix streaming.
- Resident Advisor for club culture/event authority.
- Patreon/Ko-fi/Discord for support/community.
- VI.BE for trusted institutional opportunity infrastructure.

Recommended MVP:

- Core profiles.
- Social/feed foundation.
- Opportunity submission flow.
- Profile Coach.
- Basic Opportunity Matcher.
- AI-generated profile/press-kit assets.
- Later agent expansion.

## Unified Decision From All Reports

The implementation should not chase every advanced feature at once. The first
technical proof should connect:

1. creator identity,
2. structured goals/skills/location,
3. public or seeded opportunities,
4. explainable AI matching,
5. human-reviewed application/outreach drafts,
6. feedback loops.

This creates the graph that makes later audio intelligence, scene radar, and
agent workflows defensible.

