# 54 — Marketplace Economics and Safety

**Prepared:** 03 June 2026  
**Phase:** 15 — Quest Marketplace  
**Status:** Spec / Blueprint

---

## 1. Purpose

Define the economic model and safety framework for the two MIXHIVE marketplaces (gear and Lua agents), plus strategies for expanding the platform beyond its DJ-centric base to musicians, visual artists, and other creative disciplines.

---

## 2. DJ Gear Marketplace Economics

### 2.1 Fee Model

**Phase 1 — Simple percentage fee on completed transactions:**

| Transaction value | Platform fee |
|------------------|-------------|
| €0 – €99 | 5% |
| €100 – €499 | 4% |
| €500 – €1,999 | 3% |
| €2,000+ | 2.5% |

Fee is taken from the escrowed amount at release. The seller receives `agreed_price × (1 − fee%)`.

Free listings: no charge to list. Fees apply only on completed sales (not on reserved or abandoned listings).

**Phase 2 consideration:** Optional "boost" paid listings for greater catalog visibility (flat fee, e.g. €2–5 per 30-day boost cycle).

### 2.2 Local Pickup vs. Shipping

**Local pickup:**
- No shipping fee to manage.
- Escrow still recommended for high-value items (buyer pays, releases on in-person receipt confirmation).
- For very small amounts (<€50), parties may opt to bypass escrow with explicit consent.

**Domestic shipping:**
- Seller declares shipping cost at listing time.
- Buyer pays listed price + shipping.
- Tracking number required before `transaction_state → shipped`.

**International shipping:**
- Seller marks "international available" with explicit shipping cost.
- Custom/import responsibilities: clearly flagged to buyer (platform is not liable).
- Suggested: limit escrow to EU/EEA in Phase 1 for regulatory simplicity.

### 2.3 Payout Timeline

1. Buyer confirms receipt (or auto-confirm after 7 days): `released` state.
2. Platform initiates payout via Stripe Connect or PayPal Payouts.
3. Payout lands in seller's account within 2–5 business days.

---

## 3. Lua Agent Marketplace Economics

### 3.1 Pricing Tiers

| Tier | Price | Notes |
|------|-------|-------|
| Free open | €0 | No restrictions; clone freely |
| Free + attribution | €0 | Usage requires credit in any public output |
| Paid one-time | €2–€50 | One-time purchase; license valid forever |
| Subscription | €2–€15/month | For agents with ongoing AI compute costs |

### 3.2 Revenue Split

| Tier | Creator share | Platform share |
|------|--------------|----------------|
| Free | — | — |
| Paid one-time | 70% | 30% |
| Subscription | 60% | 40% |

The higher platform cut on subscriptions covers ongoing billing infrastructure and AI compute subsidies.

**Official MIXHIVE agents** (authored by the platform team) generate revenue that funds the commons pool (team salaries, infrastructure, creator grants).

### 3.3 Payment Infrastructure

- Payouts via Stripe Connect (instant or scheduled).
- Minimum payout threshold: €20.
- Tax handling: creators are responsible for declaring income; platform issues transaction records.

### 3.4 Phase 2 — NFT Licensing

Optional future layer:
- Purchased agent licenses represented as NFTs on Base L2.
- NFT is transferable; creator earns royalty (e.g. 10%) on secondary sales.
- Unlocks: provably unique "Founding User" agent access, early-access tiers, limited editions.
- Implemented via existing `nft_collections` / `co_creator_approvals` infrastructure.

---

## 4. Trust & Safety — Gear Marketplace

### 4.1 Seller Verification

| Level | Requirement | Unlocks |
|-------|-------------|---------|
| Basic | Verified email | Listings up to €200 |
| Standard | Verified phone number | Listings up to €1,000 |
| Trusted | 5+ completed sales with ≥ 4.5 avg rating | Badge + listings up to €5,000 |
| KYC | Identity check via Stripe Identity | No limit |

### 4.2 Listing Moderation

- **Prohibited categories:** counterfeit goods, stolen equipment, weapons, non-DJ items.
- **Auto-checks on publish:** text scan for prohibited keywords; flagged listings enter manual review queue.
- **Community flagging:** "Report this listing" visible to all users; 3 flags → paused pending review.
- **Photo validation:** minimum 2 photos required; AI-assisted stock-image detector (Phase 2).

### 4.3 Dispute Resolution

**Process:**
1. Either party opens dispute within 5 days of delivery/expected pickup.
2. Both parties submit evidence (photos, tracking info, in-app messages).
3. Evidence stored immutably in Supabase Storage for 90 days.
4. MIXHIVE support reviews; resolution issued within 5 business days.

**Outcomes:**
- Full release to seller (item as described, dispute unfounded)
- Full refund to buyer (item not as described or not received)
- Partial refund (negotiated compromise)

**Escalation:** Unresolved disputes above €200 referred to payment provider mediation (Stripe/PayPal dispute process).

### 4.4 Reputation Enforcement

| Score | Action |
|-------|--------|
| < 4.0 after 5+ reviews | Account flagged; listings throttled |
| < 3.5 after 10+ reviews | Selling suspended pending support review |
| Fraudulent activity confirmed | Permanent ban; outstanding escrow returned to buyer |

---

## 5. Trust & Safety — Lua Agent Marketplace

### 5.1 Agent Review Pipeline

All agents must pass review before status changes to `published`:

**Automated checks:**
- IR validation (all blocks valid, no orphan nodes)
- Lua syntax check on generated code
- Scan for known abuse patterns (mass notification loops, unlimited API calls)
- Verify `tools_used` and `data_access_summary` are complete and accurate

**Manual review (for "Verified" badge):**
- MIXHIVE team reviews agent behavior against declared purpose
- Test run on 10 sample events
- Verify no data exfiltration patterns, no spam behavior
- Review config_schema for user-friendly defaults and safe bounds

**Badge levels:**

| Badge | Criteria |
|-------|----------|
| Community | Passed automated checks |
| Verified | Passed manual review |
| Official | Authored or co-signed by MIXHIVE team |

### 5.2 Abuse Detection

**Runtime monitoring:**
- Agents logging unusual error rates (> 20% per 24h) → flagged for review
- API call rate spikes → auto-rate-limited, admin notified
- Notification spam (> 10 notifications/user/hour from one agent) → agent paused

**User reporting:**
- "Report this agent" on catalog page and in agent inbox suggestions
- 5 reports in 48h → agent auto-paused pending review

**Admin controls:**
- `lua_agents.status = 'disabled'` — per-user disable
- `lua_agent_definitions.status = 'retired'` — remove from catalog (existing installs continue but no new installs)
- Emergency global kill: set all instances of a definition to `disabled` via admin RPC

### 5.3 Data Privacy

- Agents only access data explicitly permitted by their `tools_used` list
- `api.state.*` is scoped to the agent + user — no cross-user state reads
- Agent run logs are retained for 30 days; older runs are deleted
- Agents cannot access raw profile private data (email, phone, wallet) — only public profile fields and explicit consents

---

## 6. Strategies to Attract Musicians and Visual Artists

MIXHIVE is DJ-centric but Phase 15+ turns it into a cross-disciplinary collaboration hub. The following strategies combine product hooks, network effects, and community programs.

### 6.1 Quest-First Onboarding

When a musician or visual artist signs up, show discipline-specific quest prompts immediately:

**Musicians:**
- "Find a DJ to test your track in a live set"
- "Produce a remix for this scene's rising artist"
- "Score a short film — director posting quest now"

**Visual Artists:**
- "Design artwork for an upcoming EP"
- "Create a live visuals pack for a DJ alias"
- "Build a full brand identity for a techno collective"

These quests are surfaced before the feed, making collaboration the primary hook — not passive consumption.

### 6.2 Portfolio Integration

Allow creators to link existing work without migrating content:

| Discipline | Platform | Link type |
|------------|----------|-----------|
| Musicians | SoundCloud, Bandcamp, Spotify | Embedded player in profile |
| Visual artists | Behance, Dribbble, Instagram | Portfolio tiles with thumbnail |
| Writers | Medium, personal site | Article links with preview |
| Actors/Performers | Vimeo, YouTube | Video embeds |

Linked portfolio items are indexed for vector similarity, enabling quest matching without requiring upload to MIXHIVE Storage.

### 6.3 Scene and Project Templates

Pre-built "project archetypes" that define quests and roles:

| Template | Disciplines involved |
|----------|---------------------|
| EP Release Campaign | Producer, Cover Artist, Photographer, Copywriter, Social Strategist |
| Rave Aftermovie | DJ, Videographer, Video Editor, Graphic Designer |
| Touring Season | DJ, Booking Agent, Marketing, Social Media |
| Short Film Score | Composer/Producer, Film Director, Actors, Sound Designer |
| Visual Brand Build | DJ, Illustrator, Motion Designer, Copywriter |

Templates are selectable on quest creation, pre-filling roles and suggested timelines. Reduces friction to zero for the quest creator.

### 6.4 Partner Programs

Targeted outreach to communities where target disciplines already exist:

| Partner type | Example targets | Offer |
|-------------|-----------------|-------|
| Labels & collectives | Small underground labels, DJ collectives | Dedicated "guild" space; quests with label branding; agent credits |
| Art schools | Design faculties, animation programs | Student tier (free Verified tier for 1 year); class quest templates |
| Film schools | Short film programs | Film-score and live-visuals quest templates; equipment listings |
| Creative agencies | Freelance networks, design studios | B2B quest posting (brands posting quests to find creative talent) |
| Gaming & VJ communities | Visual performance artists | VJ quest templates; gear listings for A/V equipment |

Each partner gets a co-branded landing page and dedicated quest category.

### 6.5 Cross-Discipline Success Showcases

- Monthly "Hive Story" feature (via HiveStory component, Phase 10) profiling a cross-discipline project assembled via MIXHIVE quests.
- Case studies: "How @dj_alias and @visual_artist built an EP visual world in 3 weeks using a quest."
- Metrics shared publicly: roles filled, time to completion, repeat collaboration rate.

### 6.6 Creator-Friendly Policies

| Policy | Detail |
|--------|--------|
| Ownership | Creators retain 100% IP of work created in quests; MIXHIVE claims no license |
| Revenue | External revenue pipelines (Bandcamp, Patreon, direct contracts) are explicitly supported and not forced on-platform |
| Attribution | Quest completion credits appear on both profiles; verifiable in MythicNode |
| Off-platform deals | MIXHIVE is a coordination layer, not a walled garden; deals may be concluded off-platform |
| Data portability | Creators can export their quest history, collab network, and portfolio links |

### 6.7 Education and Community

- **Guides:** "How to run a visual-driven quest on MIXHIVE", "How to use agents to manage collabs without being technical"
- **Video walkthroughs:** discipline-specific (musician, visual artist, business role)
- **Office hours / AMA:** monthly live sessions with early adopters and team
- **Community Discord / forum:** `#visual-artists`, `#musicians`, `#business-collab` channels
- **Agent templates for non-DJs:** pre-built "Visual Portfolio Scout", "Track Feedback Collector", "Quest Assistant" agents available free on marketplace install

---

## 7. Summary Table

| Marketplace | Revenue model | Platform fee | Key safety lever |
|-------------|--------------|-------------|-----------------|
| DJ Gear | % of transaction | 2.5–5% | Escrow + dispute process + seller KYC |
| Lua Agents (paid) | One-time purchase | 30% | Agent review pipeline + runtime kill switch |
| Lua Agents (subscription) | Monthly | 40% | Subscription management + rate limits |
| Quests | Free to post | — | Reputation system + XP bail penalties |
