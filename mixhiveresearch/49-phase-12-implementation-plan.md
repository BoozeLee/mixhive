# 49 — Phase 12 Implementation Plan

**Phase 12 · Codex + Claude Code Roadmap**

> Covers: docs 45–48 implementation breakdown, migration numbers, file paths, success criteria, and verification commands.

---

## 1. Codex Tasks (Schema, API)

### Migration 076 — Audio features + extended `find_mixes_for_set_context`

**File:** `supabase/migrations/076_audio_features_mood_energy.sql`

```sql
-- Migration 076: audio_features.mood + .energy columns
--                + find_mixes_for_set_context genre_hint param
--
-- Adds optional mood/energy metadata to audio analysis.
-- Extends the Hive Composer suggestion RPC to filter by genre hint.
--
-- Resolves: Phase 12 docs 45–46

begin;

alter table public.audio_features
  add column if not exists mood   text,
  add column if not exists energy float;

-- Drop and recreate with new p_genre_hint param
drop function if exists public.find_mixes_for_set_context(vector, int, int, int);

create or replace function public.find_mixes_for_set_context(
  p_embedding  vector(1536),
  p_bpm_min    int    default 0,
  p_bpm_max    int    default 999,
  p_k          int    default 10,
  p_genre_hint text   default null
)
returns table (
  mix_id     uuid,
  title      text,
  artist     text,
  similarity float,
  bpm        numeric,
  camelot    text,
  genre      text
)
language plpgsql security definer set search_path = public as $$
begin
  set local hnsw.ef_search = 40;

  return query
  select
    m.id                                            as mix_id,
    m.title                                         as title,
    coalesce(p.username, p.display_name)            as artist,
    1 - (ae.embedding <=> p_embedding)              as similarity,
    af.bpm                                          as bpm,
    af.camelot                                      as camelot,
    m.genre                                         as genre
  from ai_embeddings ae
  join mixes m on m.id = ae.entity_id
  left join profiles p on p.id = m.user_id
  left join audio_features af on af.mix_id = m.id
  where ae.entity_type = 'mix'
    and m.is_published = true
    and (af.bpm is null or (af.bpm >= p_bpm_min and af.bpm <= p_bpm_max))
    and (p_genre_hint is null or lower(m.genre) = lower(p_genre_hint))
  order by ae.embedding <=> p_embedding
  limit p_k;
end;
$$;

revoke execute on function find_mixes_for_set_context from public;
grant execute on function find_mixes_for_set_context to authenticated, service_role;

commit;
-- Resolves: Phase 12 doc 45 §3, doc 46 §2.1
```

---

## 2. Claude Code Tasks

### `src/styles/tokens.ts`
Add after `genreColors`/`getGenreColor`:
- `moodColors` record (4 entries: peak, groove, ambient, transition)
- `getMoodColor()` helper

### `src/app/mixhive.css`
Add under `/* Motion */` section (after existing `eq-bar` keyframe):
- `@keyframes suggestionIn`
- `.suggestion-enter` class
- `.filter-chip` class

### `src/components/HexCell.tsx`
- Render `keyCamelot` prop in the `track` variant bottom row, alongside `BpmChip`. Currently the prop exists but is never rendered (line 28 of `HexCellProps`).

### `src/components/SimilarMixesPanel.tsx`
- Import `KeyChip` from `'@/components/KeyChip'`
- Render `<KeyChip keyCamelot={m.camelot} />` next to `<BpmChip>` (camelot is in `SimilarMix` interface at line 15 but never used)

### `src/components/composer/SuggestionCell.tsx`
- Add `className="suggestion-enter"` to the root `<div>` at line 52

### `src/views/HiveComposer.tsx`
Three changes (see doc 46 §2.1–2.3):
1. Add `genreFilter` + `bpmRange` state, derive from last track
2. Add filter chip row in JSX between draft banner and canvas
3. Add `vector_suggestion_dismissed` event in `handleDismissSuggestion`
4. Pass `genre_hint` + adjusted BPM range to `/api/composer/suggest`

### `src/views/HiveStory.tsx`
Two changes (see doc 48 §3.3–3.4):
1. Parse `metadata.genre_tags` from `profile_snapshot` rows → 3-period timeline display
2. Show `evolutionScore` as a labeled progress bar (Consistent / Evolving / Transformed)

### `src/app/api/composer/suggest/route.ts`
- Add `genre_hint?: string` to `SuggestBody` interface
- Pass `p_genre_hint: genre_hint ?? null` to `find_mixes_for_set_context` RPC call

---

## 3. Phasing

| Week | Task |
|---|---|
| W1 | Research docs 45–49 (this doc) |
| W1 | Migration 076 (Codex) |
| W1 | tokens.ts + mixhive.css updates (Claude Code) |
| W2 | HexCell camelot, SimilarMixesPanel camelot, SuggestionCell animation |
| W2 | HiveComposer filter chips + dismissed event + genre_hint API param |
| W2 | HiveStory 3-period timeline + evolution score bar |
| W2 | Deploy + verify |

---

## 4. Success Criteria

| Criterion | How to verify |
|---|---|
| `vector_suggestion_dismissed` fires | Dismiss a suggestion in Composer → check `experiment_events` in Supabase |
| Genre filter chip appears | Add 2 tracks in Composer → chip matching last track's genre visible below top bar |
| BPM range chip appears | Add a track with BPM data → BPM range chip visible |
| Camelot key visible in SimilarMixesPanel | Visit any mix detail page with OPENAI_API_KEY set and existing embeddings |
| HiveStory 3-period timeline | Visit Profile → Story tab for a user with ≥5 mixes uploaded |
| Evolution score bar visible | Same as above if ≥2 profile_snapshot rows exist in `ai_embeddings` |
| TypeScript clean | `npx tsc --noEmit` exits 0 |
| Build clean | `npm run build` exits 0 |

---

## 5. Verification Commands

```bash
# TypeScript
npx tsc --noEmit

# Build
npm run build

# Deploy
vercel --prod --yes
```

Manual verification:
1. `/composer` → add 2+ tracks → genre chip appears → dismiss suggestion → check Supabase `experiment_events`
2. Any mix detail page → "Similar Vibes" section shows camelot key next to BPM
3. `/profile/:id` → Story tab → 3-period genre timeline shows if profile has ≥5 mixes

---

## 6. What Phase 12 Does NOT Change

- `ai_embeddings` table structure (unified model confirmed correct, doc 45 §1)
- Existing Phase 10/11 RPCs (find_similar_mixes, find_similar_artists) — unchanged
- HexCell clip-path or hex grid layout — the composer rail stays flex-row; true hex grid is deferred
- Scene Crate Dig flow — specified in doc 46 §4, deferred to Phase 13
- `find_collab_candidates_hybrid` API endpoint — specified in doc 45 §4, deferred
