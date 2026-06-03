# 52 — Quest and Party System

**Prepared:** 03 June 2026  
**Phase:** 15 — Quest Marketplace  
**Status:** Spec / Blueprint

---

## 1. Purpose

Extend MythicNode into an RPG-style quest engine for building cross-disciplinary creative project teams. Quests are the primary mechanism for finding collaborators across all creative disciplines — DJs, producers, musicians, visual artists, animators, writers, business people, actors, and more.

A **quest** is a creative project with defined roles, goals, and a timeline. A **party** is the assembled team. **Roles** are the specific slots to fill.

---

## 2. MythicNode Extensions

### 2.1 New Node Types

#### `quest`

| Property | Type | Notes |
|----------|------|-------|
| `id` | UUID | |
| `creator_profile_id` | UUID | |
| `title` | text | e.g. "Build visual identity for my techno alias" |
| `narrative` | text | RPG-flavored story/context for the quest |
| `goals` | text[] | 3–5 concrete deliverables |
| `phase` | enum | `draft`, `recruiting`, `in_progress`, `complete` |
| `genre_tags` | text[] | e.g. `['techno', 'ambient', 'rave']` |
| `discipline_tags` | text[] | disciplines required |
| `region` | text | optional geographic scope |
| `timeline_days` | int | estimated duration |
| `deadline` | date | optional hard deadline |
| `xp_reward` | int | base XP for completion |
| `created_at` | timestamptz | |
| `completed_at` | timestamptz | |

#### `party`

| Property | Type | Notes |
|----------|------|-------|
| `id` | UUID | |
| `quest_id` | UUID FK | |
| `name` | text | auto-generated or custom |
| `formed_at` | timestamptz | |
| `dissolved_at` | timestamptz | null while active |

#### `role`

| Property | Type | Notes |
|----------|------|-------|
| `id` | UUID | |
| `quest_id` | UUID FK | |
| `role_type` | enum | see §3 |
| `title` | text | custom label, e.g. "Lead Animator" |
| `skill_tags` | text[] | e.g. `['after_effects', 'motion_design']` |
| `experience_level` | enum | `any`, `beginner`, `intermediate`, `pro` |
| `filled_by_profile_id` | UUID | null until filled |
| `is_paid` | boolean | |
| `compensation_notes` | text | e.g. "rev share + credit" |
| `status` | enum | `open`, `filled`, `withdrawn` |

### 2.2 New Edge Types

| Edge | From | To | Description |
|------|------|----|-------------|
| `quest_created_by` | `artist_profile` | `quest` | Creator relationship |
| `quest_requires_role` | `quest` | `role` | Quest → role slots |
| `party_for_quest` | `quest` | `party` | Quest → assembled team |
| `role_filled_by` | `role` | `artist_profile` | Assignment |
| `party_member` | `party` | `artist_profile` | Party membership |
| `assisted_by_agent` | `role` | `lua_agent` | Agent automating a role function |
| `completed_quest` | `artist_profile` | `quest` | Post-completion record |
| `role_completed_as` | `artist_profile` | `role` | Role-specific completion |

---

## 3. Supported Creative Disciplines

All role types are first-class and searchable:

| `role_type` | Display name | Example skill tags |
|-------------|-------------|-------------------|
| `dj` | DJ | `techno`, `house`, `vinyl`, `live_set` |
| `producer` | Producer | `ableton`, `sound_design`, `mixing`, `mastering` |
| `musician` | Musician | `guitar`, `synth`, `vocals`, `session` |
| `visual_artist` | Visual Artist | `illustration`, `branding`, `3d`, `motion` |
| `animator` | Animator | `after_effects`, `blender`, `frame_by_frame` |
| `photographer` | Photographer | `event`, `portrait`, `live` |
| `videographer` | Videographer | `recap`, `live_visuals`, `documentary` |
| `writer` | Writer / Copywriter | `press_kit`, `storytelling`, `social_copy` |
| `business` | Business / Strategy | `booking`, `management`, `marketing` |
| `actor` | Actor / Performer | `improv`, `voiceover`, `on_camera` |
| `designer` | Graphic Designer | `figma`, `print`, `ui` |
| `developer` | Developer | `web`, `vj_tools`, `nft_tech` |
| `other` | Other | freeform |

---

## 4. Quest Lifecycle

```
draft
  │  Creator publishes quest with roles defined
  ▼
recruiting
  │  Lua agents + manual search surface role candidates
  │  Interested parties apply or are invited
  │  Creator fills each role slot
  ▼
in_progress
  │  Party works on the quest
  │  Progress notes, file shares, collab sessions
  ▼
complete
  │  Creator marks complete
  │  All party members rate each other
  │  XP and reputation awarded
  │  "completed_quest" and "role_completed_as" edges created
```

---

## 5. Reward Structure

### 5.1 Quest XP and Scoring

Each quest defines:

| Component | Description |
|-----------|-------------|
| `base_xp` | Awarded for completing the quest (set by creator, e.g. 100–1000 XP) |
| `early_bonus` | +20% XP if completed before deadline |
| `rating_bonus` | +10% per 5-star review received from party members |
| `late_penalty` | −15% XP if completion is > 7 days past timeline (grace applied for emergencies) |
| `bail_penalty` | Withdrawing from a role after `in_progress` subtracts 50 XP from the bailing member |

XP is tracked per `role_type` — a DJ accumulates DJ XP, a visual artist accumulates visual artist XP. This keeps progression meaningful per discipline.

### 5.2 Titles and Badges

Awarded at XP milestones per role type:

| Tier | DJ title example | Visual Artist title example | Business title example |
|------|-----------------|---------------------------|----------------------|
| 50 XP | "Hive Freshman" | "Sketch Worker" | "The Intern" |
| 200 XP | "Resident" | "Visual Contributor" | "Scene Agent" |
| 500 XP | "Scene Builder" | "Visual Collaborator" | "Tour Architect" |
| 1000 XP | "Hive Veteran" | "Creative Director" | "Industry Connector" |
| 2500 XP | "Queen Cell" | "Hive Visionary" | "Mythic Strategist" |

Titles are displayed on profiles and in quest/party views.

### 5.3 Tiered Progression and Access Gates

| Tier | XP threshold (per role) | Access unlocked |
|------|------------------------|-----------------|
| 1 — Novice | 0–199 | Small quests (≤ 3 roles), practice collabs, community agents |
| 2 — Working | 200–499 | Mid-scale quests, access to paid quest slots, gear marketplace |
| 3 — Pro | 500–1499 | Label/venue quests, sponsor gear slots, advanced Lua agents |
| 4 — Scene Leader | 1500–2499 | Invite-only high-stakes quests, early access to new features |
| 5 — Mythic | 2500+ | Quest arbitration, agent certification, platform advisory access |

### 5.4 Graph & Opportunity Rewards

- Completing quests creates `completed_quest` edges in MythicNode, directly boosting collab agent recommendations.
- High-reputation quest finishers are surfaced first by `api.quests.suggest_role_candidates`.
- Completing certain quests unlocks dependent quests (e.g. "Booked at a regional venue" unlocks "International Booking" quest tier).

### 5.5 Post-Quest Peer Ratings

After `complete` state:
- Each party member rates every other member on: **Craft** (1–5), **Collaboration** (1–5), **Reliability** (1–5).
- Ratings feed into a per-role reputation score (rolling average of last 20 ratings).
- Displayed on profile as "★ 4.8 as Visual Artist (12 quests)".
- Anonymous ratings (rater is shown only to platform admins for dispute resolution).

### 5.6 Optional Economic Rewards

- NFT quest-completion tokens: unique collectible per notable quest (e.g. "Founding Collaborator of [Project Name]"). Minted on Base L2 via existing NFT infrastructure.
- Gear marketplace discounts for Tier 3+ users (e.g. 5% platform fee waiver on gear transactions).
- Revenue share on projects: off-platform in Phase 1; smart contract rev-share in Phase 2 for quests with defined commercial outputs.

---

## 6. Quest Matching & Discovery

### 6.1 Matching Logic

For each open role in a quest, the system surfaces candidate profiles using a hybrid approach:

**Graph signals (from MythicNode):**
- Prior connections to quest creator (shared follows, past collabs)
- Completed quests in same discipline
- Scene overlap (genre tags, location proximity)

**Vector signals (from Phase 10 embedding infrastructure):**
- Cosine similarity between quest `narrative + goal` embedding and profile `bio + mix descriptions` embedding
- Style vector alignment

**Combined score:**
```
match_score = 0.5 × graph_score + 0.5 × vector_score
              + 0.1 × reputation_bonus (if tier ≥ 3)
              − 0.2 × recent_bail_penalty (if bailed in last 60 days)
```

### 6.2 Quest Discovery Feed

Quests appear in `/discover` and a dedicated `/quests` page as "RPG-style mission cards":

```
┌────────────────────────────────────────────────┐
│ [RECRUITING]            ★ VISUAL + BRAND        │
│                                                 │
│ ⚔  Build a visual identity for my techno alias  │
│                                                 │
│ "My alias SVRFACE needs a full visual world..." │
│                                                 │
│ Roles needed:                                   │
│  [Illustrator]  [Motion Designer]  [Copywriter] │
│                                                 │
│ 📍 Brussels  ·  Genre: Techno                   │
│ ⏱  30 days  ·  XP: 400 base                    │
│                                                 │
│                          [Apply for a Role →]   │
└────────────────────────────────────────────────┘
```

**Filters:** discipline, genre, region, XP reward, duration, compensation type (paid/rev-share/credit).

**"Quests for You" section:** Lua agents curate a personalized list based on match score.

---

## 7. Cross-Discipline Example Quests

### "Build a Visual Brand for My Techno Alias"
Roles: Visual Artist (Illustrator), Motion Designer, Copywriter  
Goals: Logo, social kit, 3 animated clips, press bio  
Timeline: 4 weeks | Base XP: 350

### "Short Film with Bespoke Score and DJ Cameo"
Roles: Film Director, Composer/Producer, DJ, Actor (2), Videographer  
Goals: 8-minute short film, original score, distribution-ready  
Timeline: 8 weeks | Base XP: 900

### "EP Release — Full Creative Package"
Roles: Mastering Engineer, Cover Artist, Photographer, Copywriter, Social Media Strategist  
Goals: Mastered EP, artwork, press photos, promo copy, 4-week release schedule  
Timeline: 6 weeks | Base XP: 600

### "Rave Aftermovie"
Roles: Videographer, Video Editor, Graphic Designer (for title cards)  
Goals: 4-minute aftermovie, teaser clip, full-length cut  
Timeline: 2 weeks post-event | Base XP: 300

### "Build a Booking Strategy for a Mid-Tier DJ"
Roles: Booking Agent / Manager, Copywriter (for booking pitch), Business Strategist  
Goals: Pitch deck, target venue list, 3-month outreach plan  
Timeline: 3 weeks | Base XP: 400

---

## 8. Integration with Phase 10 Hybrid Vector + Graph Infrastructure

Quest creation triggers:
- Embedding of `title + narrative + goals` using `embedAndStoreEntity` (`src/lib/embed-entity.ts`)
- Entity stored in `ai_embeddings` with type `quest`
- HNSW index (`migration 074`) used for similarity lookups

Quest role matching uses:
- `find_mixes_for_set_context` RPC pattern as template for a new `find_profiles_for_role` RPC
- Combined graph + vector score computed server-side in the RPC

---

## 9. Phase 16 Implementation Targets

- Migration: `quests`, `parties`, `roles`, `quest_applications`, `quest_reviews` tables
- MythicNode: 3 new node types + 8 new edge types
- Supabase RPCs: `find_profiles_for_role(role_id, limit)`, `get_quest_party(quest_id)`, `complete_quest(quest_id)`
- Lua API surface: `api.quests.create`, `api.quests.update`, `api.quests.suggest_role_candidates`, `api.party.add_member`
- Views: `/quests` (discovery), `/quests/[id]` (detail + apply), `/quests/new` (create), `/quests/[id]/party` (manage party)
- XP and reward system wired to `quest_reviews` post-completion
