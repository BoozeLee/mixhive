# 51 — Lua Agent Marketplace Specification

**Prepared:** 03 June 2026  
**Phase:** 15 — Quest Marketplace  
**Status:** Spec / Blueprint

---

## 1. Purpose

Define a marketplace inside MIXHIVE where creators can discover, buy, share, and publish Lua agents — reusable automations, workflow templates, and AI-powered tools tuned for DJs, producers, and creative collaborators.

The Lua Agent Marketplace is the distribution layer for the no-code builder (doc 53). Every published agent becomes a catalog entry here.

---

## 2. Data Model

### 2.1 `lua_agent_packages`

The catalog record for a publishable agent. Distinct from `lua_agent_definitions` (the user's private draft) — a package is a curated, versioned, shareable product.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `creator_profile_id` | UUID FK → profiles | |
| `name` | text | e.g. "Scene Collab Scout" |
| `tagline` | text | 1 sentence, ≤ 120 chars |
| `description` | text | markdown, full detail |
| `category` | enum | see §2.2 |
| `tags` | text[] | free-form, e.g. `['discovery', 'techno', 'booking']` |
| `discipline_focus` | text[] | `['dj', 'producer', 'visual_artist', 'business']` |
| `complexity` | enum | `beginner`, `intermediate`, `advanced` |
| `price` | numeric(8,2) | 0 = free |
| `currency` | char(3) | default `EUR` |
| `license` | text | `free_open`, `free_attribution`, `paid_personal`, `paid_commercial` |
| `version` | text | semver string, e.g. `1.2.0` |
| `lua_definition_id` | UUID FK → lua_agent_definitions | points to the versioned source |
| `config_schema` | jsonb | JSON Schema describing user-configurable parameters |
| `capabilities` | text[] | ≤ 5 bullet highlights |
| `tools_used` | text[] | `['graph', 'vectors', 'quests', 'marketplace', 'notifications']` |
| `data_access_summary` | text | plain-language permissions description |
| `screenshot_urls` | text[] | flow diagram / UI screenshots |
| `install_count` | int | cached, incremented on install |
| `avg_rating` | numeric(3,2) | cached rolling average |
| `rating_count` | int | |
| `official` | boolean | MIXHIVE-authored agent |
| `verified` | boolean | passed safety review |
| `status` | enum | `draft`, `published`, `retired` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 2.2 Category Enum

```
discovery          — Find mixes, artists, collaborators
booking            — Venue matching, tour planning
social_automation  — Feed curation, reply suggestions
collab_coordinator — Quest creation, party matching
visual_brand       — Artwork briefs, brand strategy
quest_automation   — Quest lifecycle management
analytics          — Stats, trend analysis
gear_assistant     — Gear recommendations, marketplace alerts
custom             — User-defined
```

### 2.3 `lua_agent_package_installs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `package_id` | UUID FK | |
| `profile_id` | UUID FK | |
| `agent_instance_id` | UUID FK → lua_agents | created on install |
| `version_installed` | text | snapshot of version at install time |
| `config` | jsonb | user's configured parameters |
| `installed_at` | timestamptz | |

### 2.4 `lua_agent_package_reviews`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `package_id` | UUID FK | |
| `reviewer_profile_id` | UUID FK | |
| `rating` | smallint | 1–5 |
| `comment` | text | |
| `created_at` | timestamptz | |
| UNIQUE on `(package_id, reviewer_profile_id)` | | one review per user |

---

## 3. MythicNode Integration

### 3.1 New Node Type: `lua_agent_package`

Properties: id, name, category, discipline_focus, price, install_count, avg_rating, official, verified.

### 3.2 New Edge Types

| Edge | From | To | Description |
|------|------|----|-------------|
| `created_by` | `artist_profile` | `lua_agent_package` | Creator relationship |
| `owns_agent` | `artist_profile` | `lua_agent_package` | Install/ownership |
| `used_in_quest` | `lua_agent_package` | `quest` | Agent deployed on a quest |
| `assistant_for_role` | `lua_agent_package` | `role` | Agent assists a specific role type |
| `inspired_by` | `lua_agent_package` | `lua_agent_package` | Fork/clone lineage |

---

## 4. Discovery & Catalog UX

### 4.1 Catalog Page (`/marketplace/agents`)

**Left sidebar:**
```
Categories (accordion):
  ├ Discovery
  ├ Booking
  ├ Social Automation
  ├ Collab Coordinator
  ├ Visual & Brand
  ├ Quest Automations
  ├ Analytics
  └ Gear Assistant

Filters:
  Price:    Free | Paid | Any
  Badge:    Official | Verified | Community
  Focus:    DJ | Producer | Visual Artist | Business
  Complexity: Beginner | Intermediate | Advanced
  Rating:   4★+ | 3★+
```

**Main content:** responsive agent card grid (2–4 columns).

### 4.2 Agent Card

```
┌────────────────────────────────────────┐
│ [Category chip]     [Official badge?]  │
│                                        │
│ Scene Collab Scout                     │
│ Find collaborators aligned to          │
│ your scene and sound                   │
│                                        │
│ 🎧 DJ  🎹 Producer                    │
│                                        │
│ ✓ Finds matching profiles by scene     │
│ ✓ Suggests collab quests               │
│ ✓ Weekly digest to inbox               │
│                                        │
│ ★ 4.7  (82 reviews)  412 installs      │
│                 FREE  [View Details]   │
└────────────────────────────────────────┘
```

### 4.3 Agent Detail Page (`/marketplace/agents/[id]`)

Tabs:

**Overview**
- Full description (markdown rendered)
- Intended users, use cases, example outcomes
- Creator profile card

**Capabilities**
- Tools it uses (`graph`, `vectors`, `quests`, etc.)
- Configurable parameters (rendered from `config_schema`)
- Flow diagram screenshots

**Safety & Permissions**
- `data_access_summary` (plain English)
- Tools used list
- Rate limits and resource caps

**Reviews**
- Paginated list of user reviews (rating + comment)
- Aggregate breakdown (5★ 4★ 3★ 2★ 1★)

**Actions (right panel):**
- `Install` — attaches agent to user's profile (creates `lua_agents` row)
- `Configure` — opens builder with pre-filled parameters from `config_schema`
- `Clone & Edit` — forks `lua_agent_definitions` into user's workspace (if `license` allows)

---

## 5. Purchase & Activation Flows

### 5.1 Free Agent (price = 0)

1. User clicks **Install**.
2. `lua_agent_package_installs` row created.
3. `lua_agents` instance created (definition_id = package's definition, owner = user).
4. Redirect to Configure modal pre-filled with `config_schema` defaults.
5. Agent is live on user's profile.

### 5.2 Paid Agent (price > 0)

1. User clicks **Install** → payment flow (Stripe Checkout or in-app purchase).
2. On payment success: same as free flow above.
3. `lua_agent_package_installs.version_installed` recorded for license tracking.
4. Future upgrades: user receives notification; upgrade is free if within major version.

### 5.3 Subscription Agent (future)

- Monthly fee for premium agent access (e.g., agents that use expensive AI calls).
- Billing handled via Stripe Subscriptions.
- Install persists while subscription is active; agent pauses on lapse.

### 5.4 Attribution (free_attribution license)

- Agent is free but requires credit in any public output (e.g., "Powered by [Agent Name] by @creator").
- Attribution check is honor-based in Phase 1; enforceable via NFT license in Phase 2.

---

## 6. Agent Lifecycle

```
Creator drafts in builder
         │
         ▼
  lua_agent_definitions (draft)
         │
    Publish →
         ▼
  lua_agent_packages (published)  ◀── Safety review for "Verified" badge
         │
    Install ─────▶  lua_agent_package_installs + lua_agents (instance)
         │
    Retire ─────▶  status = retired (existing installs continue; new installs blocked)
```

---

## 7. Economics Summary

| Model | Agent types | Creator revenue share |
|-------|------------|----------------------|
| Free open | Templates, demos | — |
| Free + attribution | Community contributions | — (reputation) |
| Paid one-time | Specialized tools | 70% of purchase price |
| Subscription | AI-heavy, high-cost | 60% of recurring revenue |

MIXHIVE retains 30–40% as platform fee (subject to legal/billing infra readiness).

Optional Phase 2: NFT-based licensing (token = license, transferable on secondary market; creator earns royalty on resale).

---

## 8. Phase 16 Implementation Targets

- Migration: `lua_agent_packages`, `lua_agent_package_installs`, `lua_agent_package_reviews`
- MythicNode: `lua_agent_package` node type + 5 edge types
- API routes: `GET /api/marketplace/agents`, `GET /api/marketplace/agents/[id]`, `POST /api/marketplace/agents/[id]/install`, `POST /api/marketplace/agents/[id]/review`
- Views: `/marketplace/agents` (catalog), `/marketplace/agents/[id]` (detail)
- Lua API: `api.marketplace.find_agents`, `api.marketplace.get_agent_info`
