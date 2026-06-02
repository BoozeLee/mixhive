# 42 — Hive Stories and Journey Views

**Phase 10 · Product + UX Spec**

> Depends on: doc 39 (sound evolution vectors), doc 41 (`HexCell`, `getGenreColor`, `SoundEvolutionBanner`)
> Extends: doc 29 §4.4 (Creator Profile view — adds "Story" as a new tab)
> References: doc 24/30 (mythic_edges schema), doc 31 (agent state persistence)

---

## 1. Concept

A "Hive Story" is a visual timeline of a DJ's journey through MIXHIVE — rendered as a horizontal
honeycomb chain of milestone cells on their creator profile.

Each cell ("chapter") represents a significant career moment: a first collab, a gig performed,
a quest completed, a supporter pass created. The chain is read left-to-right, oldest to newest.

Below the milestone chain, a "Sound Evolution" banner shows how the artist's sonic signature
has shifted over time using their mix embeddings from `ai_embeddings`.

### 1.1 Where it lives

Route: The profile view (e.g. `src/views/DjProfile.tsx`) already has tabs:
`Mixes | Playlists | Quests | NFT Passes | About`

Phase 10 adds a **Story** tab, making it:
`Mixes | Playlists | Quests | Story | NFT Passes | About`

Story tab is visible on all profiles. The content is only shown if the user has opted in (§5
Privacy). For profiles that haven't opted in, the tab shows an empty state:
"This artist hasn't shared their journey yet."

### 1.2 What it is NOT

- Not a feed or activity stream (that is the home feed)
- Not a quest timeline (that is the `/quests` view with quest lanes)
- Not a graph visualisation (no node/edge diagram — this is a narrative, not a technical view)

---

## 2. Chapter Data Model

### 2.1 Source data

Chapters are derived from `mythic_edges` ordered by `created_at`:

```sql
select
  edge_type,
  to_node_id,
  created_at,
  props
from mythic_edges
where from_node_id = (
  select id from mythic_nodes
  where node_type = 'artist_profile'
  and external_id = :profile_id
  limit 1
)
order by created_at asc
limit 50;
```

### 2.2 Chapter classification

Each `edge_type` maps to a chapter type and display label:

| edge_type | Chapter type | Label template |
|---|---|---|
| `collab_with` | `collab` | "Collab with {artist_name}" |
| `performed_at` | `gig` | "Gig at {venue_name}" |
| `owns_nft_of` + soulbound=true | `gig_proof` | "Gig proof earned" |
| `submitted_to` | `opportunity` | "Applied to {opp_name}" |
| `quest_milestone` | `quest` | "Quest milestone reached" |
| `session_produced_mix` | `set` | "Set composed: {playlist_title}" |
| `backed_quest` | `quest_backing` | "Backed a quest" |

**Chapter vs. event:**
- The **first occurrence** of each `chapter_type` becomes a full-size chapter cell (`HexCell lg`)
- Subsequent occurrences are event cells (`HexCell sm`) — visible but compact
- This prevents a high-volume user from having 40 identical "Gig at venue" large cells

### 2.3 `get_profile_story` RPC (Codex handoff)

```sql
create or replace function public.get_profile_story(p_profile_id uuid)
returns table (
  chapter_type  text,
  label         text,
  date          timestamptz,
  is_chapter    boolean,
  props         jsonb
)
language plpgsql security definer set search_path = public as $$
declare
  v_node_id uuid;
  v_seen_types text[] := '{}';
begin
  select id into v_node_id
  from mythic_nodes
  where node_type = 'artist_profile' and external_id = p_profile_id
  limit 1;

  if v_node_id is null then return; end if;

  return query
  select
    case me.edge_type
      when 'collab_with'         then 'collab'
      when 'performed_at'        then 'gig'
      when 'owns_nft_of'         then 'gig_proof'
      when 'submitted_to'        then 'opportunity'
      when 'quest_milestone'     then 'quest'
      when 'session_produced_mix' then 'set'
      when 'backed_quest'        then 'quest_backing'
      else 'other'
    end as chapter_type,
    -- label derived from props (Codex to fill with joined data)
    coalesce(me.props->>'label', me.edge_type) as label,
    me.created_at as date,
    -- first occurrence of each type is a chapter
    not (
      me.edge_type = any(
        array_agg(me.edge_type) over (
          order by me.created_at rows between unbounded preceding and 1 preceding
        )
      )
    ) as is_chapter,
    me.props
  from mythic_edges me
  where me.from_node_id = v_node_id
  order by me.created_at asc
  limit 50;
end;
$$;

revoke execute on function get_profile_story from public;
grant execute on function get_profile_story to authenticated, service_role;
```

---

## 3. Sound Evolution Vector

### 3.1 Concept

The sound evolution feature answers: "How has this DJ's style changed over time?"

It does this by:
1. Taking all of a profile's published mixes, ordered by `created_at`
2. Dividing them into 3 temporal windows: early / middle / recent (by count, not time — so a
   new artist with 3 mixes still gets 1 per snapshot)
3. Computing the centroid (mean vector) of each window's mix embeddings
4. Measuring cosine similarity between the early and recent centroids as an "evolution score"
5. Finding the nearest-neighbor genre tags at each centroid to describe the sound shift

### 3.2 Evolution score semantics

```
similarity ≥ 0.9  → "Consistent" — sound has stayed very close to its roots
0.7–0.9           → "Evolving" — gradual drift, recognisable through-line
0.5–0.7           → "Transitioning" — meaningful style change
< 0.5             → "Transformed" — radically different sound arc
```

### 3.3 Snapshot storage

Each snapshot centroid is stored in `ai_embeddings` with:
- `entity_type = 'profile_snapshot'`
- `entity_id = profile_id`
- `entity_key = 'profile_snapshot:{profile_id}:{index}'` where index = 1, 2, or 3
- `metadata = { snapshot_index: 1|2|3, period_start: ISO, period_end: ISO, mix_count: N }`

The snapshot is recomputed by the `embed-refresh` cron (doc 39 §2.2) when the profile's mix
count increases by ≥5 mixes since last computation.

### 3.4 LLM narrative annotation

After computing the 3 snapshot centroids, the sound evolution agent runs `find_similar_mixes` for
each centroid to find the top-3 nearest mixes in the catalog. From those mixes' genre and tag
metadata, it builds a short narrative via LLM:

```
Early sound neighbors: {genres/tags from snapshot-1 nearest mixes}
Recent sound neighbors: {genres/tags from snapshot-3 nearest mixes}
Prompt to LLM: "In one sentence, describe this artist's sound journey from {early} to {recent}."
```

Result is stored in `ai_embeddings.metadata.narrative` on the most recent snapshot row, and
surfaced in the UI as a gold `MythicPulseCard`-style annotation (doc 29 §5).

---

## 4. HiveStory UI

### 4.1 Overall layout

The Story tab is full-width within the central canvas (max 900px, doc 29 §2). It has 3 visual
sections stacked vertically:

```
┌──────────────────────────────────────────────────────────────┐
│  Section A: Milestone chain (horizontal hex scroll)          │
├──────────────────────────────────────────────────────────────┤
│  Section B: Sound evolution banner (gradient waveform)       │
├──────────────────────────────────────────────────────────────┤
│  Section C: Agent annotation card (gold left-border)         │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Section A: Milestone chain

A horizontally scrollable row of `StoryChapterCell` components:

- Chapter cells (`is_chapter=true`): `HexCell lg` (180×208px) with icon + label + year
- Event cells (`is_chapter=false`): `HexCell sm` (64×74px) with icon + year only
- Connected by a thin horizontal line at mid-height: `border-top: 1px solid colors.border`
  running between cells (rendered as an `<hr>` between cells, positioned absolutely)
- Scroll container: `overflow-x: auto`, `-webkit-overflow-scrolling: touch`,
  `scrollbar-width: thin`, custom scrollbar color (`colors.border` / `colors.accent`)

Desktop: All cells visible if they fit; horizontal scroll if >6 chapters
Mobile: Horizontal scroll always; cells stack to show at minimum 1.5 cells in viewport
(so user knows they can scroll)

### 4.3 Chapter cell content

For chapter cells (`HexCell lg`, §1.2 in doc 41):

```
[icon: emoji matching chapter_type]    ← centred top
[label: "First Collab with X"]         ← 14px semibold, truncated
[year/month: "Jun '26"]               ← 12px dim
[optional: genre color accent strip]   ← left edge via getGenreColor
```

Chapter type → icon mapping:
- `collab` → 🤝
- `gig` → 🎤
- `gig_proof` → ⬡ (hex shape, on-chain proof)
- `opportunity` → 🎯
- `quest` → ⚡
- `set` → 🎧
- `quest_backing` → 💠

### 4.4 Chapter hover / tap

On hover (desktop) or tap (mobile): the right 340px panel (doc 29 §2) slides in with a
**Chapter Detail card** showing:

- Full label (untruncated)
- Date (formatted: "15 June 2026")
- Context: "At this point you had {follower_count} followers, {collab_count} collabs, and were
  active in {scene} scene" — derived from the `props` JSONB of the edge
- If `chapter_type = 'gig'`: venue name + city
- If `chapter_type = 'collab'`: collaborator's profile avatar + name (linked)
- If `chapter_type = 'set'`: playlist title + track count

### 4.5 Section B: Sound Evolution Banner

`SoundEvolutionBanner.tsx` — full-width, ~120px tall.

Visual: a horizontal gradient bar transitioning from `getGenreColor(earlyGenre)` on the left
to `getGenreColor(recentGenre)` on the right, with a waveform shape SVG clip (using sine wave
path) applied over it.

Below the gradient: 3 labelled markers at 0%, 50%, 100% of the bar:
- Left: "Early: {earlyTags}" (dim text)
- Centre: "↔" (evolution score label: "Consistent" / "Evolving" / "Transitioning" / "Transformed")
- Right: "Now: {recentTags}" (dim text)

If no evolution data yet (< 3 mixes): banner shows a shimmer placeholder skeleton.

### 4.6 Section C: Agent Annotation Card

A `MythicPulseCard`-style card (doc 29 §5 — gold left border, `colors.accentFaint` background):

> "⚡ Your sound has stayed in the techno-industrial corridor while broadening your BPM range
> from 130 to 142 over 18 months. Your most consistent element: a preference for 8A–9A keys."

This narrative comes from `ai_embeddings.metadata.narrative` on the most recent snapshot row.
If no narrative yet: "Your sound story is being analysed — check back soon."

---

## 5. Privacy and Opt-In

The Hive Story is opt-in. By default, the Story tab shows the empty-state message
"This artist hasn't shared their journey yet."

**Settings toggle:** Settings → Profile section → "Share my journey" (checkbox, off by default)
When enabled: stores `profiles.show_journey = true` (new column, Codex adds in migration 075).

**Visibility rules:**
- `show_journey = true`: Story tab shows full content to all visitors
- `show_journey = false`: Story tab shows empty state to all visitors (including the profile owner)
- Profile owner can always see a preview in their own Settings before enabling

**What data is shown publicly:**
- Only `mythic_edges` data — no private messages, no DMs, no payment data
- Collaborator names are shown with their public profile info (no private data)
- Evolution score and narrative are derived from publicly available mix metadata

---

## 6. Loading and Empty States

| State | Display |
|---|---|
| Loading | 3 shimmer `HexCell lg` + shimmer banner (`.skeleton` class) |
| No edges yet (< 3 mythic edges) | "Your journey is just beginning. Start by collaborating, gigging, or completing a quest." |
| Opted out (viewer sees other profile) | "This artist hasn't shared their journey yet." |
| < 3 mixes for evolution | Evolution section shows shimmer + "Being analysed…" |
| API error | Generic error state with "Retry" button |

---

## Codex Handoff

- **`get_profile_story` security-definer RPC** (migration 075)
- **`profiles.show_journey` column** — `boolean not null default false` (migration 075 or new 076)
- **`profile_snapshot` entity_type** — new `entity_type` value in `ai_embeddings`; no schema change needed
- **Sound evolution computation** — runs as part of `/api/cron/embed-refresh` (doc 39 §2.2): after refreshing profile embeddings, compute 3-snapshot centroids + call LLM for narrative

## Claude Code Handoff

- **`src/views/HiveStory.tsx`** — Story tab content; queries `get_profile_story` RPC
- **`src/components/story/StoryChapterCell.tsx`** — wraps `HexCell` with chapter-specific content
- **`src/components/story/SoundEvolutionBanner.tsx`** — gradient waveform + evolution markers
- **Profile view** (`src/views/DjProfile.tsx` or equivalent) — add "Story" to the tab list
- **Settings view** (`src/views/Settings.tsx`) — add "Share my journey" toggle (boolean, POST to profile update)
