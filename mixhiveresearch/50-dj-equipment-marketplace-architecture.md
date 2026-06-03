# 50 — DJ Equipment Marketplace Architecture

**Prepared:** 03 June 2026  
**Phase:** 15 — Quest Marketplace  
**Status:** Spec / Blueprint

---

## 1. Purpose

Provide a second-hand DJ and studio equipment marketplace embedded inside MIXHIVE, tuned to how DJs and producers actually buy and sell gear — local pickups, community trust, fair pricing, and transparent escrow.

The marketplace lives inside the MIXHIVE graph (MythicNode), so listings naturally connect to artist profiles, scenes, and quests.

---

## 2. Data Model

### 2.1 `equipment_listings`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `seller_profile_id` | UUID FK → profiles | |
| `title` | text | e.g. "Pioneer CDJ-2000NXS2 — excellent condition" |
| `description` | text | freeform, markdown supported |
| `category` | enum | `mixer`, `controller`, `turntable`, `cdj`, `monitor`, `headphones`, `synthesizer`, `sampler`, `interface`, `cable_accessory`, `other` |
| `brand` | text | e.g. "Pioneer DJ", "Allen & Heath", "Technics" |
| `model` | text | e.g. "CDJ-2000NXS2" |
| `condition` | enum | `new`, `like_new`, `used_good`, `used_fair`, `for_parts` |
| `price` | numeric(10,2) | |
| `currency` | char(3) | ISO 4217, default `EUR` |
| `location_city` | text | |
| `location_country` | char(2) | ISO 3166-1 alpha-2 |
| `location_region` | text | optional |
| `photos` | text[] | array of Supabase Storage URLs |
| `shipping_options` | jsonb | `{ local_pickup: bool, domestic_shipping: bool, international_shipping: bool, shipping_notes: text }` |
| `preferred_payment` | text[] | `['cash', 'bank_transfer', 'paypal', 'stripe']` |
| `status` | enum | `active`, `reserved`, `sold`, `hidden` |
| `views_count` | int | incremented on page view |
| `saves_count` | int | cached from equipment_saves |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 2.2 `equipment_transactions`

Tracks the lifecycle of a sale after buyer and seller agree.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `listing_id` | UUID FK → equipment_listings | |
| `buyer_profile_id` | UUID FK → profiles | |
| `seller_profile_id` | UUID FK → profiles | |
| `agreed_price` | numeric(10,2) | |
| `currency` | char(3) | |
| `payment_provider` | text | `stripe`, `paypal`, `manual` |
| `payment_reference` | text | external payment/escrow ID |
| `transaction_state` | enum | see state machine below |
| `shipped_at` | timestamptz | |
| `tracking_number` | text | optional |
| `delivered_at` | timestamptz | |
| `dispute_opened_at` | timestamptz | |
| `dispute_notes` | text | |
| `resolved_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 2.3 `equipment_saves`

```sql
equipment_saves (
  profile_id UUID FK → profiles,
  listing_id UUID FK → equipment_listings,
  saved_at   timestamptz,
  PRIMARY KEY (profile_id, listing_id)
)
```

### 2.4 `equipment_reviews`

Post-transaction ratings between buyer and seller.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `transaction_id` | UUID FK | |
| `reviewer_profile_id` | UUID FK | |
| `reviewee_profile_id` | UUID FK | |
| `role` | enum | `buyer`, `seller` |
| `rating` | smallint | 1–5 |
| `comment` | text | |
| `created_at` | timestamptz | |

---

## 3. Transaction State Machine

```
none
  │
  ▼  buyer initiates purchase
pending_payment
  │
  ▼  payment captured into escrow
paid_escrow
  │
  ├──▶ [seller ships / arranges pickup]
  ▼
shipped
  │
  ├──▶ [buyer opens dispute]        → disputed → resolved → released | refunded
  ▼
delivered
  │
  ▼  buyer confirms receipt
released          (funds sent to seller)
```

State transitions are persisted in `equipment_transactions.transaction_state`. RLS ensures only the buyer or seller (and admins) can advance their respective transitions.

---

## 4. MythicNode Integration

### 4.1 New Node Type: `equipment_listing`

Properties mirroring the listing schema above. Indexed by category, condition, price, location, and status.

### 4.2 New Edge Types

| Edge | From | To | Description |
|------|------|----|-------------|
| `listed_by` | `artist_profile` | `equipment_listing` | Seller relationship |
| `interested_in` | `artist_profile` | `equipment_listing` | Save/watch relationship |
| `sold_to` | `equipment_listing` | `artist_profile` | Completed sale |
| `scene_gear` | `scene` | `equipment_listing` | Gear relevant to a scene (e.g. techno mixers) |

### 4.3 Agent-Accessible Queries

Lua agents can call:

```lua
api.marketplace.find_listings({ category = "mixer", max_price = 500, location_country = "BE" })
api.marketplace.get_listing(listing_id)
api.marketplace.suggest_listings_for_profile(profile_id, { limit = 5 })
```

---

## 5. UX Flows

### 5.1 "List Gear" — Seller Flow

A guided multi-step form:

**Step 1 — Category & Item**
- Select category (grid of icons: Mixer, CDJ, Turntable, Controller, Monitor, etc.)
- Brand + Model fields with autocomplete (from a curated brand/model seed list)
- Condition selector with plain-language descriptions per option

**Step 2 — Description & Photos**
- Free-text description field with character count (min 80 chars encouraged)
- Photo upload (up to 10, stored in Supabase Storage `gear-photos` bucket)
- Auto-tips: "Include photos of the back panel, any scratches, and original accessories"

**Step 3 — Price & Location**
- Price field with currency selector
- "Fair price estimate" helper (optional — uses category + condition to suggest a range based on existing listings)
- Location: city + country; optional "pickup only" or shipping checkboxes

**Step 4 — Payment & Review**
- Preferred payment methods (multi-select)
- Summary preview
- Publish / Save as draft

### 5.2 "Browse Gear" — Buyer Flow

**Filters (persistent sidebar / collapsible on mobile):**
- Category (multi-select)
- Condition (multi-select)
- Price range (min/max slider)
- Location (country dropdown + "Near me" if location permission granted)
- Shipping available (toggle)

**Listing card:**
- Primary photo (4:3, lazy-loaded)
- Title, brand/model, condition badge, price
- City, country
- "Save" heart icon

**Listing detail page:**
- Photo carousel
- Full description, condition badge with tooltip
- Seller profile card (avatar, username, reputation score from `equipment_reviews`)
- Transaction state (available / reserved / sold)
- "Contact Seller" — opens in-app message thread (or reveals contact preference)
- "Make Offer" (off-platform; records interest in `equipment_saves` with offer note)

---

## 6. Escrow Design

### Phase 1 — Off-Chain Trusted Processor

1. Buyer clicks "Buy Now" or "Proceed to Payment".
2. Payment captured via Stripe or PayPal into an escrow hold.
3. `transaction_state` moves to `paid_escrow`.
4. Seller is notified to ship or arrange pickup.
5. Buyer confirms receipt (or auto-confirms after 7 days with no dispute).
6. Funds released to seller via platform payout.

**Dispute path:**
- Either party opens dispute within 5 days of delivery/expected pickup.
- Both parties submit evidence (photos, tracking, chat screenshots).
- MIXHIVE support reviews and issues resolution within 5 business days.
- Resolution: release funds to seller OR full/partial refund to buyer.

### Phase 2 — Optional Web3 Escrow

For users with connected wallets:
- On-chain escrow contract on Base L2 holding USDC or equivalent stablecoin.
- Same state machine; shipping and dispute resolution remain off-chain.
- Smart contract releases funds on confirmed delivery signal from platform oracle.
- Only relevant if both buyer and seller have connected wallets and opt in.

---

## 7. Trust & Safety

| Layer | Mechanism |
|-------|-----------|
| Seller verification | Verified email required before listing; optional ID check for listings > €500 |
| KYC cap | Transactions above a threshold (e.g. €1,000) trigger lightweight KYC before escrow is initiated |
| Ratings | Post-transaction buyer/seller ratings (1–5 stars + comment) |
| Reputation score | Rolling average of last 20 ratings, displayed on seller profile card |
| Photo requirements | Minimum 2 photos required to publish; AI scan for placeholder/stock images (future) |
| Listing moderation | Automated text scan for prohibited items; community flagging; manual review queue |
| Dispute evidence | Both parties upload evidence; immutably stored in Supabase Storage for 90 days |
| Ban & suspension | Sellers with < 3.0 rating after 5+ reviews are flagged; support reviews |

---

## 8. Integration Touchpoints

- **Feed:** "Gear Listings Near You" widget in right rail on `/feed` for logged-in users.
- **Profile:** "Selling" tab on DJ profiles showing their active listings.
- **Quests:** Listing can be marked as "quest gear" (e.g. gear needed for a touring quest).
- **Lua agents:** `marketplace.suggest_listings_for_profile` enables agents to recommend gear.
- **Notifications:** New matches on saved searches, message from seller, offer received.

---

## 9. Phase 16 Implementation Targets

- Migration: `equipment_listings`, `equipment_transactions`, `equipment_saves`, `equipment_reviews`
- MythicNode: `equipment_listing` node type + 4 edge types
- API routes: `GET/POST /api/marketplace/gear`, `GET/PATCH /api/marketplace/gear/[id]`, `POST /api/marketplace/gear/[id]/transaction`
- Views: `/marketplace/gear` (browse), `/marketplace/gear/[id]` (detail), `/marketplace/gear/new` (list)
- Lua API surface: `api.marketplace.find_listings`, `api.marketplace.suggest_listings_for_profile`
