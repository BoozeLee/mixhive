# AI Band — Agent Provenance for Tracks

**Date:** 2026-06-16 · **Status:** Approved design (Beehive Studio integration deferred)

## Context & problem

MixHive can ingest a finished track via `POST /api/mixes/publish` (it creates a `mixes` row and
uploads audio), but it captures **nothing about the AI agents that co-produced the track**. The
platform's signature claim — "AI agents as first-class band members" — has no representation in the
product: you can't see which agents played on a track, what they did, or browse a track's "AI band."

This spec adds a **MixHive-native agent-provenance capability ("AI Band")**: a track can carry
AI-agent co-producer credits, shown as band-member cards, with a badge and a queryable
"tracks featuring this agent" view. It is self-contained MixHive value today and the substrate the
future Beehive Studio flywheel will populate.

### Non-goals (explicitly deferred)
- **Beehive Studio integration / branding.** No Beehive-specific demo, no "Made in Beehive"
  branding, no wiring into the separate Beehive app. Provenance is source-agnostic. (The existing
  endpoint's `platform_links.source` tag is left as-is but does not drive any new behavior.)
- "Connect Beehive" device-auth handshake (keep the current JWT bearer auth).
- Stems/remix, NFT, or rev-share on provenance.

## Data model — migration `103_ai_agent_provenance.sql`

Follows the repo's idempotent-migration conventions (guards, `if not exists`, RLS policies).

- **`mix_agent_credits`** — one row per agent credit on a track:
  - `id uuid pk default gen_random_uuid()`
  - `mix_id uuid not null references public.mixes(id) on delete cascade`
  - `agent_slug text not null` — normalized key for grouping/browse (derived from name)
  - `agent_name text not null`
  - `agent_role text` — e.g. "Beatsmith", "Sound Design", "Arrangement"
  - `contribution text` — short description of what the agent did
  - `model text` — underlying model/version, optional
  - `ord int not null default 0` — display order
  - `created_at timestamptz not null default now()`
  - Indexes: `(mix_id)`, `(agent_slug)`.
  - RLS: `select` public (`using (true)`); `insert` allowed only when the parent mix is owned by
    the caller (`exists (select 1 from mixes where id = mix_id and dj_id = auth.uid())`); no client
    `update`; `delete` cascades with the mix (no direct client delete policy).
- **`mixes.ai_band boolean not null default false`** — cheap signal for the badge and discovery
  filtering without scanning the credits table; set `true` when ≥1 credit is ingested.

## API — extend `POST /api/mixes/publish` (`src/app/api/mixes/publish/route.ts`)

Backward compatible: with no provenance the route behaves exactly as today.

- Accept `metadata.provenance = { agents: [{ name, role?, contribution?, model? }], sessionId? }`.
- Validate: `agents` is an array, ≤ 24 entries; each `name` required and trimmed; string fields
  length-capped (name ≤ 80, role ≤ 60, contribution ≤ 280, model ≤ 60); silently drop empties.
- After the existing mix insert: if valid agents exist, insert credit rows
  (`agent_slug = slugify(name)`, `ord` = array index) and update `mixes.ai_band = true`.
- Credits insertion is best-effort relative to the published track: on credit-insert error, still
  return the created mix `id`/`url` but include `provenanceError` in the JSON (the track is live;
  credits can be retried). Return shape otherwise unchanged.
- `slugify(name)`: lowercase, trim, non-alphanumeric → `-`, collapse repeats, strip ends. Lives in
  a small shared helper `src/lib/slug.ts` (reused by the route and tests).

## Types & API client (`src/lib/types.ts`, `src/lib/api.ts`)

- Add `ai_band?: boolean` to the `Mix` type; add `MixAgentCredit` type.
- `getMixAgentCredits(mixId)` → ordered credits for a mix (used by `MixDetail`).
- `getMixesByAgent(slug)` → mixes that have a credit with `agent_slug = slug` (join via
  `mix_agent_credits`), ordered by recency. Follows existing `if (!isSupabaseConfigured) return []`
  guards.

## UI

- **`AiBandBadge`** (`src/components/AiBandBadge.tsx`) — a gold "✦ AI Band" pill, rendered on
  `MixCard` and `MixDetail` when `mix.ai_band`. Tokenized colors only; 320px-safe.
- **`AgentBandCredits`** (`src/components/AgentBandCredits.tsx`) — panel on `MixDetail` placed after
  the `WaveformPlayer`/description (~line 224), before Comments. Heading "AI Band — co-produced by
  agents" + one band-member card per credit (hex avatar with agent initial reusing the
  `LevelBadge` hex aesthetic, name, role chip, contribution line, model chip). Each card links to
  the agent browse view. Hidden when there are no credits.
- **Agent browse** — route `/ai-band/agent/:slug` (`src/views/AgentTracks.tsx`) → "Tracks featuring
  `<agent>`" list reusing `MixCard`, with loading skeleton + `EmptyState`. Registered in
  `src/App.tsx` (shared file — one lazy route + `<Route>`, same pattern as the Phase 16 leaderboard).

## Demo + tests

- **`scripts/provenance_publish_demo.mjs`** — source-agnostic test publisher: generates a tiny valid
  WAV, builds the multipart form with `metadata.provenance.agents`, and `POST`s to
  `/api/mixes/publish` with a JWT passed via arg/env; prints the resulting `/mix/:id`. Lets us
  exercise ingestion end-to-end without any track-authoring UI.
- **Tests:**
  - Extend `src/__tests__/mixes-publish-route.test.ts`: provenance path inserts credit rows, sets
    `ai_band`, and the no-provenance path is unchanged.
  - `src/__tests__/slug.test.ts`: `slugify` cases.
  - Component render test for `AiBandBadge` + `AgentBandCredits`.

## Verification

- Gates: `npx tsc --noEmit`, `npm run test`, `npm run build`.
- Apply migration `103` locally (or against the dev DB) and run
  `node scripts/provenance_publish_demo.mjs <baseURL> <jwt>`; open the returned `/mix/:id` and
  confirm the badge + AI Band panel, then `/ai-band/agent/:slug` lists the track.
- Visual spot-check with `npm run visual <baseURL> /mix/<id> /ai-band/agent/<slug>` at 1440 & 320
  (offline sandbox shows shells; populated states verified where data is reachable).

## Critical files

- New: `supabase/migrations/103_ai_agent_provenance.sql`, `src/lib/slug.ts`,
  `src/components/AiBandBadge.tsx`, `src/components/AgentBandCredits.tsx`, `src/views/AgentTracks.tsx`,
  `scripts/provenance_publish_demo.mjs`, tests.
- Edit: `src/app/api/mixes/publish/route.ts`, `src/lib/types.ts`, `src/lib/api.ts`,
  `src/components/MixCard.tsx`, `src/views/MixDetail.tsx`, `src/App.tsx`.
