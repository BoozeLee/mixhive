# MIXHIVE Strategic Intelligence Report — Execution Notes

Source: user-provided strategic report dated 27 May 2026.

## Core Direction

MIXHIVE should be built as the AI manager and opportunity network for underground DJs, producers, promoters, visual artists, and local music scenes. The defensible wedge is not another feed or streaming service; it is the combination of:

- AI Mix Intelligence.
- Opportunity Match Engine.
- Press Kit + Booking Outreach Agent.
- Scene Radar and partner intelligence.
- Human-first, AI-assisted workflows.

## Build Order Accepted

1. Audio Intelligence MVP:
   - BPM, key/Camelot, mood, energy, structure.
   - Later AudD/ACRCloud/Pex track recognition.
   - Later Essentia worker and Trigger.dev/Inngest orchestration.
2. Opportunity Engine + Press Kit Agent:
   - Curated Belgian/Flemish opportunities.
   - Explainable matching.
   - EPK URLs as viral loop.
   - Human-reviewed application drafts.
3. VI.BE-style pilot:
   - Public or consent-based data.
   - 20-50 opted-in creators.
   - Aggregate results only.
4. Belgian launch before international expansion:
   - Brussels/Ghent/Antwerp first.
   - Berlin/Amsterdam after Belgian traction.

## Guardrails

- No DAW first.
- No ticketing platform first.
- No streaming replacement first.
- No crypto-first strategy.
- No generative music AI as first-year product.
- Never auto-send booking or application outreach.
- Do not train generative music models on user uploads.
- Keep public/institutional partner views aggregate-only unless creators explicitly opt in.

## Current Implementation Mapping

- Opportunity Hub: implemented as `/opportunities` with explainable scores, local actions, and persistent save/apply/dismiss support when Supabase migrations are active.
- Press Kit Agent: implemented as `/epk`, `/epk/:slug`, `/api/epk`, and `press_kits`.
- Audio Intelligence MVP: started with `audio_features`, `mix_tracks`, `/api/audio-intelligence/:mixId`, and `MixAudioIntelligence`.
- Agent Inbox: implemented as `/agents/inbox` for suggestions, tasks, and opportunity review.

## Next Engineering Targets

- Push pending Supabase migrations once `SUPABASE_ACCESS_TOKEN` is available.
- Replace deterministic audio preview with real low-cost audio feature extraction.
- Add `opportunity_applications` instead of overloading `opportunity_saves`.
- Add editable EPK sections and PDF export.
- Add model routing/cost caps before adding heavy AI vendors.
- Add partner dashboard only after enough aggregate data exists.
