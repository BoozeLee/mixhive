# MixHive — Endgame Plan: Start to Finish

> **Scope:** Everything remaining from today (Jul 21, 2026) through full public launch
> and scale. Grounded in the live codebase, schema (migrations 001–117), worker tier running
> since Jul 5, and production at `mixhive.vercel.app`. Companion docs:
> `ENGINEERING_ROADMAP.md`, `PHASE_HANDOFF.md`, `PATH_TO_LAUNCH.md`,
> `BLUEPRINT_REALIZATION_INVENTORY.md`, `DESIGN_SYSTEM.md`.
>
> **Total estimate: 12–18 weeks to v1.0 launch**

---

## 0. Current State

### Deployed in Production
- **Core social platform:** feed, profiles, follows, reposts, mentions, likes, comments, playlists, search, notifications (23 types), direct messaging, scenes
- **Marketplaces:** gear marketplace with Stripe Connect escrow (code-complete, TEST mode only), agent marketplace with 70/30 paid tiers, trusted-seller badges
- **Progression:** XP + reputation system with full UI (level badge, XP bar, reputation meter, `/leaderboard`, quest-completion XP)
- **AI-native layer:** AI-Band provenance (`mix_agent_credits`, credits UI, "AI Band" badge, `publish_mix_with_credits` RPC), Agents as Artists (`ai_agents` + `ai_agent_follows`, `/ai-band/agent/:slug` page)
- **Audio worker** (Go, Podman): waveform/duration/BPM/energy/mood/musical key — **live since Jul 5** on the box
- **Ruby scheduler** (Podman): fires 11 crons Vercel Hobby can't (push-sender, nft-sync, etc.) — **live since Jul 5**
- **Subscriptions:** 4-tier system (free/supporter/insider/patron), Stripe Billing, premium mix gating
- **Infrastructure:** migrated from dead `vlaio-vanderbouw` to BeeHiveStudio Supabase project, migration 117 current
- **Routes shipped:** 65+ views, 115 API routes, 99 components, 24 Lua agents, 58 test files (313 passing)

### Not Yet Deployed / Partially Built
- Stripe Connect payouts: code-complete but never run in live (TEST mode only, no seller ever onboarded)
- Worker Cloudflare Tunnel: blocked on outbound port 7844
- Beehive Studio desktop publish bridge: code written, never E2E tested
- AI-Band discovery index/leaderboard: `/ai-band` index exists but agent leaderboard is stubbed
- Scene pages (persistent `scenes`/`scene_members`): migration 090 exists, no UI beyond `/scenes` list
- Creator studio analytics 2.0: partial (recap email exists, timeseries rollups in migration 107)
- CRON_SECRET unset in Vercel → all cron routes are open
- Exposed secrets: Supabase PAT + service-role key need rotation
- 40+ stale remote branches
- Turn.mixhive.app VPS not provisioned (Coturn image shipped)
- Localized privacy policies / i18n: FR/NL/DE strings not wired
- E2E CI: flaky, credentials not wired for Playwright auth specs

---

## 1. Phase 0 — Security & Production Cutover (Week 1–2)

**Highest priority: fixes live vulnerabilities and completes the cutover.**

### 1.1 Rotate Exposed Secrets
- [ ] Revoke Supabase PAT `sbp_31bb…` (already identified as leaked in worker.env)
- [ ] Rotate Supabase service-role key → update `worker.env` + Vercel env
- [ ] Rotate Stripe live keys (secret + webhook signing secret) in Stripe dashboard
- [ ] Regenerate `CRON_SECRET` → set in Vercel + `worker.env`
- [ ] Run `docs/SECURITY_ROTATION_RUNBOOK.md` fully
- [ ] Verify after each rotation: health endpoint, Quadlet status, git hygiene

### 1.2 Set CRON_SECRET in Vercel
- [ ] Generate strong secret (`openssl rand -hex 32`)
- [ ] Add to Vercel production env
- [ ] Update `worker.env` on the box
- [ ] Verify all cron endpoints respond 401 without correct secret
- [ ] Verify scheduler calls succeed with Bearer token

### 1.3 Enable Stripe Connect (TEST Mode)
- [ ] Enable Connect (Express) in Stripe dashboard — branding, payout schedule
- [ ] Add `payment_intent`/`transfer`/`charge.dispute`/`charge.refunded` events to webhook
- [ ] Verify webhook signatures in `/api/marketplace/stripe-webhook`
- [ ] Set test-mode keys in Vercel + `.env.development`
- [ ] **E2E money loop:** create gear listing → buyer buys (escrow) → seller ships → buyer confirms → payout transfers → verify in `platform_fee_ledger`
- [ ] Agent purchase 70/30 split: buy → payout to agent creator
- [ ] Test dispute flow: open dispute → freeze → resolve → refund
- [ ] Test held payout (seller not onboarded) → sweep on onboarding
- [ ] Document test results in `docs/STRIPE_TEST_SETUP.md`

### 1.4 Worker Tier Stability
- [ ] Cloudflare Tunnel: resolve outbound port 7844 (router config or relocate server)
- [ ] Verify `worker.mixhive.app` → `localhost:3000` / `api/health/worker` responds
- [ ] Set up uptime monitoring (Uptime Kuma or similar)
- [ ] Add worker logs rotation (Podman or journald)
- [ ] Document worker restart procedure in runbook

### 1.5 Clean Up Repository
- [ ] Delete 40+ stale remote branches
- [ ] Audit `.env*` files for leaked secrets
- [ ] Verify `.gitignore` is correct
- [ ] Run `npx tsc --noEmit` and fix any type errors
- [ ] Run `npm run lint` and reduce warnings
- [ ] Run `npm run build` — must pass clean

---

## 2. Phase α — Pre-Launch Quality Gate (Week 2–4)

**Blocks everything below. Zero-errors on all quality gates.**

### 2.1 Design System Hardening
- [ ] **Hex→Token migration:** replace all inline hex in `src/views/` with `tokens.ts` references
  - Priority order: Feed, Profile, Dashboard, Login/Register, all auth views
  - Use `grep -r '"#' src/views/` to find raw hex
- [ ] **ESLint raw-hex rule:** promote `no-restricted-syntax` to `error` once budget hits 0
- [ ] Converge duplicate ad-hoc buttons/inputs onto canonical `ui/Button`, `HiveButton`, `Input`, etc.
- [ ] **Empty/loading/error state inventory:** audit all 65+ views; ensure every data-fetching view has all three states
  - Pattern: `error` state + Retry button + inline danger banner
  - Pattern: `<LoadingSpinner size="lg" />` or `<SkeletonFeed />`
  - Pattern: `<EmptyState iconKey="..." title="..." body="..." />`
  - Current: Phase 2a covered 10 secondary views; ~55 remain to audit
- [ ] **320px mobile sweep** per component (Phase 2b only covered core views)

### 2.2 TypeScript Clean
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] Fix all `any` types (search for `: any`, `as any`)
- [ ] Add proper type exports from `database.types.ts` where missing
- [ ] Ensure all API routes have typed request/response

### 2.3 Lint Clean
- [ ] `npm run lint` — 0 warnings (currently set to `--max-warnings=9999`)
- [ ] Fix all `@typescript-eslint/no-explicit-any`
- [ ] Fix all `react-hooks/exhaustive-deps`
- [ ] Fix all `jsx-a11y/` violations
- [ ] Enable strict lint in CI

### 2.4 Test Coverage Gap
- [ ] Write tests for **high-priority untested routes:**
  - `marketplace/gear/*` (buy, ship, confirm, dispute, boost, deliver)
  - `marketplace/agents/*` (buy, list)
  - `marketplace/stripe-webhook` (Connect account updates, disputes, refunds)
  - `ai/generate-art`, `ai/generate-avatar`, `ai/generate-bio`
  - `stripe/connect/onboard`, `stripe/connect/status`
  - `live-rooms/*` (create, join, leave, messages)
  - `events/*` (create, update, rsvp)
  - `mythic/sessions/*` (create, join, messages, votes)
  - `cron/*` (payouts-auto-release, push-sender, embed-refresh, nft-sync)
  - `health/*`
- [ ] Target: at least 1 test per route handler (happy path + error case)
- [ ] Current: 58 test files → target 90+

### 2.5 E2E / CI Pipeline
- [ ] Wire real test credentials for Playwright auth specs
- [ ] Fix Playwright CI flakiness (currently failing)
- [ ] Make `test:ci` green: `npm run type-check && npm run lint && npm run format:check && npm test && npm run build`
- [ ] Add Playwright to CI pipeline (GitHub Actions)
- [ ] Lighthouse budget for key routes: `/feed`, `/dashboard`, `/profile/[username]`, `/mix/[id]`
- [ ] Axe-core a11y checks in E2E

### 2.6 Performance Budget
- [ ] Bundle analysis: `npm run analyze` — identify large chunks
- [ ] Lazy-load heavy dependencies (three.js, ethers, @react-pdf/renderer — used in few routes)
- [ ] AVIF/WebP for all uploaded images (CDN-level)
- [ ] Prefetch critical routes on hover (feed, profile, mix detail)
- [ ] Aim: Lighthouse > 90 on mobile for top 5 routes

---

## 3. Phase β — AI-Band Discovery & Agent Artistry (Week 3–4)

**Extends the unique AI-Band wedge. Cheap, high visibility.**

### 3.1 AI-Band Index Polish
- [ ] `/ai-band` index: add filtering by genre, popularity, follower count
- [ ] Agent leaderboard at `/ai-band` (by followers, plays, credits on mixes)
- [ ] Reuse `/leaderboard` pattern (XP/reputation) — agent version
- [ ] Add nav entry for AI-Band index (header/sidebar)
- [ ] Shareable agent artist cards (OG image for `/ai-band/agent/:slug`)

### 3.2 Discovery Surface
- [ ] Surface "AI Band" in `/discover` as a lane
- [ ] Add `agent` type to global search (`/search`)
- [ ] Provenance filter in feed RPC: "show mixes with AI credits" toggle
- [ ] "Agents to feature" section on profile pages

### 3.3 Agent Following
- [ ] Notification when followed agent publishes a mix with credits
- [ ] Agent activity in feed (agent follows, agent credits on new mixes)
- [ ] Agent profile: stats (tracks credited, plays from credited tracks, follower count)

---

## 4. Phase γ — Adoption Ritual (Week 4–6)

**First real users + first €. Targets: 50 registered, 20 MAU, >€0 revenue.**

### 4.1 Invite-Only Onboarding (Founding Members)
- [ ] Migration 105 (`invite_founding_members`) → build invite UI
- [ ] `/invite/check` + `/invite/redeem` routes → E2E tested
- [ ] "Founding Member" badge on profiles (`FoundingMemberBadge.tsx` exists)
- [ ] Honey-Drop share card (OG image + social preview)
- [ ] Invite quota: each founding member gets 5 invites
- [ ] Email invite flow (Resend API key → set in Vercel)

### 4.2 Seed Content
- [ ] Seed 5 gear listings (admin-created, real gear)
- [ ] Create 3 collab quests (admin-created, real collab calls)
- [ ] Ensure at least 1 quest completes to trigger XP payout

### 4.3 Weekly "Ritual Drop" Listening Event
- [ ] Reuse collab-session realtime infrastructure
- [ ] Scheduled weekly event: listen together, chat, vote on tracks
- [ ] Replay available after (`RitualReplay.tsx` exists)
- [ ] Notification: "Ritual Drop starts in 1 hour"
- [ ] Post-event: auto-publish recording as unlisted mix

### 4.4 First Paid Event
- [ ] Create first paid event (Stripe checkout, €5–10 ticket)
- [ ] Gate access behind payment/webhook verification
- [ ] Trigger subscription switch (first paying user)
- [ ] KPI: >€0 revenue

### 4.5 Feedback Loop
- [ ] In-app feedback widget (NPS survey after first session)
- [ ] Discord community → invite link in onboarding
- [ ] Monitor for first 50 DJs: drop-off points, feature requests, bugs

---

## 5. Phase δ — Beehive ↔ MixHive Flywheel (Week 6–7)

**Complete the loop between Beehive Studio (desktop DAW) and MixHive (platform).**

### 5.1 Bridge Completion
- [ ] E2E test `POST /api/bridge/publish` from Beehive to MixHive
- [ ] Verify `mix_agent_credits` are preserved through the bridge
- [ ] Handle auth: device-auth handshake "Connect Beehive" page
- [ ] OAuth flow: Beehive → MixHive authorization

### 5.2 Beehive Deep Links
- [ ] "Open in Beehive" button on mixes (deep link `beehive://mix/{id}`)
- [ ] "Edit in Beehive" for own mixes
- [ ] Beehive project ↔ MixHive mix bidirectional link

### 5.3 Data Feedback
- [ ] Trend data flowing back to Beehive agents (plays, likes, demographics)
- [ ] Audience data from MixHive → Beehive producer dashboard

---

## 6. Phase ε — Scene Pages & Discovery 2.0 (Week 7–9)

**Persistent community pages, scene leaderboards, scene-scoped feeds.**

### 6.1 Scene Infrastructure
- [ ] Migration 090 exists (`scenes`, `scene_partners`) → build UI:
  - [ ] `/scene/:slug` — scene page with mixes, members, leaderboard, events
  - [ ] `/scenes` — browse all scenes (already exists as list; needs full grid)
  - [ ] Auto-membership from genre/location in profile
  - [ ] Join/leave scene
  - [ ] Scene feed (filtered by scene)
  - [ ] Scene leaderboard (top artists by XP within scene)
- [ ] OG/SEO for scene pages (SSR metadata)
- [ ] Scene-scoped notifications: "New mix in your scene"

### 6.2 Discovery 2.0
- [ ] Multi-lane discover hub (`/discover`): trending, rising, by genre, by scene, AI-recommended
- [ ] Feed tabs: For You, Following, Trending, Scene
- [ ] "Rising" lane (velocity-based — recently gaining traction)
- [ ] AI-curated "Your Weekly Discovery" (agent-powered)
- [ ] `/trending` route — dedicated trending page (currently redirects to feed)

---

## 7. Phase ζ — Creator Studio (Week 9–12)

**Analytics 2.0, portfolio, EPK polish, insights.**

### 7.1 Analytics Dashboard
- [ ] Timeseries plays/likes/followers via `profile_analytics_daily` (migration 107)
- [ ] `/dashboard` analytics widgets: 7d/30d/all-time
- [ ] Top mixes by plays, likes, saves
- [ ] Audience: follower growth, top listeners (by play count)
- [ ] Export: CSV download of analytics data
- [ ] AI insights: "Your energy-focused techno sets perform 40% better than your ambient mixes"

### 7.2 Content Performance
- [ ] `ContentPerformance.tsx` exists — integrate with real data
- [ ] Genre distribution bars
- [ ] BPM range analysis across a DJ's catalog
- [ ] Mood distribution (peak/groove/ambient/transition)
- [ ] Tracklist common tracks (most-played tracks across mixes)

### 7.3 Monthly Recap
- [ ] `/api/cron/monthly-recap` — triggered by scheduler
- [ ] Email: top mix, total plays, new followers, new fans
- [ ] In-app recap card (shareable)

### 7.4 EPK 2.0
- [ ] EPK themes: dark, light, magazine, minimal
- [ ] EPK PDF export with photos, stats, contact, bio
- [ ] EPK share link (`/epk/:slug`) with OG card
- [ ] QR code for physical press kits

### 7.5 Creator Dashboard v1
- [ ] "Hive Growth OS" dashboard: profile completeness, next-best actions, AI suggestions
- [ ] Tasks list from agent suggestions
- [ ] Onboarding checklist progress

---

## 8. Phase η — Live & Streaming (Week 12–14)

**Go streaming/WebSocket gateway, listening parties, RTMP→HLS ingest.**

### 8.1 Streaming Infrastructure
- [ ] Go streaming gateway (Podman) — P4 in worker tier architecture
- [ ] WebSocket gateway for live rooms
- [ ] RTMP→HLS ingest (ffmpeg on the box)

### 8.2 Live Rooms Enhancement
- [ ] `live_rooms` migration (112) exists → add scheduled/duration rooms
- [ ] Live chat (real-time via Supabase Realtime)
- [ ] "Live now" discovery on feed
- [ ] Go-live notification to followers
- [ ] Recording: auto-save as unlisted mix after stream

### 8.3 Listening Parties
- [ ] `listening_parties` schema
- [ ] Synchronized playback (server-timed, all listeners hear same beat)
- [ ] Party chat
- [ ] "Host a listening party" for own mixes

---

## 9. Phase θ — Hardening (Week 14–15)

**Quality, performance, observability, a11y, security — cross-cutting.**

### 9.1 Observability
- [ ] Sentry for frontend + API routes (already configured via `@sentry/nextjs`)
- [ ] Custom performance monitoring: API route timings, DB query timings
- [ ] Worker health dashboard: queue depth, processing time, error rate
- [ ] Uptime monitoring for `mixhive.vercel.app` + worker tier

### 9.2 Security
- [ ] WAF/rate-limit rules (Vercel WAF or Cloudflare)
- [ ] Bot protection for signup/login routes
- [ ] RLS audit: verify every table has appropriate RLS policies
- [ ] Input validation sweep: every API route should use Zod schemas
- [ ] File upload validation: MIME type, size, malware scanning

### 9.3 Accessibility
- [ ] Axe-core sweep on all routes — fix violations
- [ ] Keyboard navigation audit: all interactive elements reachable and operable
- [ ] Focus management: route changes, modals, dialogs
- [ ] Screen reader testing: announcements for dynamic content
- [ ] Color contrast: verify all text meets WCAG AA

### 9.4 Performance
- [ ] Lighthouse budget enforcement in CI
- [ ] Image optimization: CDN-level AVIF/WebP conversion
- [ ] Bundle size budgets: 200KB initial JS, 500KB total
- [ ] Prefetch/Prefetch: critical routes, API calls
- [ ] Caching: CDN cache headers for static content, SWR for API data

### 9.5 Backup & DR
- [ ] Verified Supabase backups (daily, point-in-time recovery)
- [ ] Worker-box DR runbook: rebuild from scratch
- [ ] Database migration rollback procedure

---

## 10. Phase ι — Scale, i18n & Launch Readiness (Week 15–18)

### 10.1 Internationalization
- [ ] Wire `next-intl` strings across all views
- [ ] EN + NL shipping at launch
- [ ] FR, DE, ES as follow-up
- [ ] Language switcher in settings (`LanguageSwitcher.tsx` exists)
- [ ] Localized privacy policies, terms, cookie consent

### 10.2 Label & A&R Tier
- [ ] Label profiles: can discover, message, and sign artists
- [ ] A&R dashboard: trending artists, genre-specific discovery
- [ ] Label can post paid quests (B2B revenue)

### 10.3 NFT Quest Completion
- [ ] Quest completion → mint NFT token (proof of achievement)
- [ ] Smart-contract rev-share for collab quests
- [ ] Foundation: migrations 066–073 (NFT tables + wallet + SIWE)

### 10.4 Mobile PWA Hardening
- [ ] Service worker: offline cache for core routes
- [ ] Push notification reliability
- [ ] Mobile install prompt
- [ ] PWA audit: Lighthouse PWA checklist
- [ ] Future: React Native wrapper for app store deployment

### 10.5 Multi-Region Caching
- [ ] CDN: multi-region edge caching
- [ ] Database read replicas (Supabase)
- [ ] Global worker deployment (multi-region Podman)

### 10.6 Billing Maturity
- [ ] Subscription management (upgrade/downgrade/cancel)
- [ ] Invoice history in dashboard
- [ ] VAT handling for EU customers
- [ ] B2B invoicing for label/partner tier
- [ ] VLAIO reporting data export

### 10.7 Launch
- [ ] DNS: `mixhive.app` + `www.mixhive.app` → Vercel
- [ ] SEO: sitemap, robots.txt, OG for all public routes, structured data
- [ ] Press kit for launch: screenshots, team bio, story, contact
- [ ] Partner landing pages (VI.BE, De Morgen, RA, Mixmag)
- [ ] Beta → Public: remove invite gate
- [ ] **KPI targets:**
  - 500 registered users (30d post-launch)
  - 100 MAU
  - >€100 revenue (subscriptions + marketplace fees)
  - Lighthouse > 90 on top 5 routes
  - 0 P0/P1 bugs

---

## 11. Infrastructure & Operations

### 11.1 Worker Tier Production Maturity
- [ ] **P3 — Warm Lua runtime container** (next worker session): Pre-warm wasmoon pool for strategic agents, eliminate cold start for agent executions
- [ ] **P4 — Go streaming gateway**: WebSocket gateway for live room audio, RTMP→HLS ingest for scheduled streams
- [ ] Worker box: migrate from GTX 1080 box to dedicated VPS (or colo)
- [ ] Worker monitoring: Prometheus + Grafana or similar
- [ ] Horizontal scaling: multiple worker instances when queue depth exceeds threshold

### 11.2 CI/CD Pipeline
- [ ] GitHub Actions: `test:ci` on every PR
- [ ] Vercel Preview Deployments: auto-deploy every PR
- [ ] Playwright E2E on preview deployments
- [ ] Lighthouse CI: budget check on deploy
- [ ] Sentry release tracking: associate deploys with error reports

### 11.3 DNS & Domains
- [ ] `mixhive.app` → Vercel (currently deferred)
- [ ] `www.mixhive.app` → Vercel
- [ ] `mixhive.vercel.app` as canonical until DNS is configured
- [ ] `turn.mixhive.app` → Coturn VPS
- [ ] `worker.mixhive.app` → Cloudflare Tunnel → worker tier

### 11.4 Monitoring & Alerting
- [ ] Uptime monitoring: `mixhive.vercel.app`, worker health endpoint
- [ ] Error alerting: Sentry P0/P1 alerts → email/Discord
- [ ] Business monitoring: signups, revenue, MAU
- [ ] Cost monitoring: Vercel, Supabase, OpenAI, Stripe fees

---

## 12. Testing Strategy

### 12.1 Unit Tests (jest)
- [ ] Current: 58 test files, 313 passing
- [ ] Target: 90+ test files, 500+ tests
- [ ] Libraries: `@testing-library/react`, `jest-environment-jsdom`
- [ ] Coverage target: 60% line coverage, 80% for critical paths (auth, payments, API routes)

### 12.2 Integration Tests (jest + Supabase)
- [ ] API route tests with mocked Supabase client
- [ ] Stripe webhook handler tests with real signature verification
- [ ] Lua agent execution tests

### 12.3 E2E Tests (Playwright)
- [ ] Auth flow: signup → email verification → login → onboard
- [ ] Core flows: upload mix → browse feed → follow → like → comment
- [ ] Marketplace: create listing → buy → ship → confirm → payout
- [ ] Mobile: 320px viewport for key flows
- [ ] Desktop + Mobile Chrome projects configured (in `playwright.config.ts`)

### 12.4 Visual Regression
- [ ] `npm run visual` — bundled Chromium screenshots + overflow/console check at 320/768/1440
- [ ] Compare against baseline on PR

### 12.5 Manual Testing Checklist
Per phase:
- [ ] Design system consistency
- [ ] 320px mobile check
- [ ] Empty/loading/error states for all new views
- [ ] Keyboard navigation
- [ ] Screen reader (VoiceOver/NVDA)
- [ ] Dark theme consistency

---

## 13. Security & Compliance

### 13.1 GDPR Compliance
- [ ] Account deletion flow E2E tested: request → 30-day grace → hard delete
- [ ] Data export: `/api/account/export` returns all user data
- [ ] Consent record: `/api/consent` stores cookie/GDPR preferences
- [ ] Privacy policy, terms, cookie policy — localized

### 13.2 RLS Audit
- [ ] Every table in `database.types.ts` has an RLS policy
- [ ] No table accessible without auth unless intentionally public
- [ ] Storage bucket RLS: verify all 5 buckets have correct policies
- [ ] Service-role key: only used in server-side contexts (API routes, worker)

### 13.3 API Security
- [ ] Rate limiting: implement on auth routes, social actions, AI generation
- [ ] Input validation: Zod schemas on all API route inputs
- [ ] CORS: restrict to `mixhive.app` + Vercel preview domains
- [ ] CSP: production CSP allows no `unsafe-eval` (already enforced in build)

---

## 14. Launch Sequence

### Week 16 — Closed Beta
```
Day 1:  Rotate secrets, enable Stripe TEST mode, verify CRON_SECRET
Day 2:  Announce to 5 trusted DJs → manual invite
Day 3:  Bug fix cycle from beta feedback
Day 4:  Expand to 50 founding members (migration 105 invites)
Day 5:  First paid event → trigger subscription
Day 6:  Seed content: 5 gear listings, 3 collab quests
Day 7:  Weekly Ritual Drop → E2E tested
```

### Week 17 — Pre-Launch
```
Day 1:  DNS: point mixhive.app → Vercel
Day 2:  SEO sweep: sitemap, robots.txt, OG images
Day 3:  Press kit assembled and distributed
Day 4:  Partner landing pages live (VI.BE, etc.)
Day 5:  Lighthouse budget green, a11y sweep complete
Day 6:  Final Stripe TEST mode E2E (full money loop)
Day 7:  Go/no-go decision
```

### Week 18 — Public Launch
```
Day 1:  Remove invite gate → open registration
Day 2:  Press release: De Morgen, RA, Mixmag
Day 3:  Monitor: error rates, performance, cost
Day 4:  Community: Discord Q&A, feedback collection
Day 5:  First week KPI review
Day 6:  Bug fix cycle
Day 7:  Post-launch retrospective
```

### Post-Launch (Ongoing)
- Weekly Ritual Drop
- Monthly feature releases (Scene pages, streaming, mobile app)
- Quarterly business review (KPI: registered users, MAU, revenue, retention)
- Continuous: bug fixes, performance, a11y, security

---

## 15. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Exposed secrets compromised | Data breach, unauthorized access | Low (immediate rotation) | Rotate before any other work |
| Worker box goes down | No waveform/BPM/key on new uploads | Medium | Jobs stay queued (idempotent); resume on restart |
| CRON_SECRET unset exploited | Cron endpoints triggered maliciously | Medium | Set in Phase 0 before any paid-feature cron |
| Stripe Connect onboarding friction | Sellers can't cash out | Medium | Express onboarding; clear docs; test mode first |
| Supabase database hits limits | Service degradation | Low (current scale) | Monitor; upgrade plan as needed |
| OpenAI API cost from agent usage | Unexpected bills | Medium | Rate limit; cache; use GPT-4o-mini by default |
| Browser compatibility | Mobile users can't use key features | Medium | Test on Safari iOS, Chrome Android, Firefox |
| E2E CI flakiness | No confidence in deploys | High | Fix Playwright config; mock external services |

---

## 16. Key Metrics Dashboard

Track weekly on a dashboard (Notion, Basecamp, or in-app admin):

| Metric | Current | 30d Target | 90d Target | 180d Target |
|--------|---------|-----------|-----------|------------|
| Registered users | ~10 (dev + test) | 50 | 500 | 5000 |
| Monthly active users | ~2 | 20 | 100 | 1000 |
| Revenue (monthly) | €0 | >€0 | €500 | €5000 |
| Mixes uploaded | ~100 (dev) | 200 | 1000 | 10000 |
| Gear listings | 0 | 5 | 50 | 500 |
| Agent marketplace sales | 0 | 3 | 30 | 300 |
| Lighthouse score (mobile) | ~75 | >85 | >90 | >92 |
| Test count | 313 | 400 | 500 | 600+ |
| P0/P1 bugs open | Unknown | <3 | <2 | <1 |

---

## 17. Implementation Order Summary

```
Week 1-2:   Phase 0 — Security & Production Cutover
Week 2-4:   Phase α — Pre-Launch Quality Gate
Week 3-4:   Phase β — AI-Band Discovery (parallel with α)
Week 4-6:   Phase γ — Adoption Ritual
Week 6-7:   Phase δ — Beehive Bridge
Week 7-9:   Phase ε — Scene Pages & Discovery 2.0
Week 9-12:  Phase ζ — Creator Studio
Week 12-14: Phase η — Live & Streaming
Week 14-15: Phase θ — Hardening
Week 15-18: Phase ι — i18n, Scale & Launch
Week 16:    Closed Beta
Week 17:    Pre-Launch
Week 18:    Public Launch
```

**Overlapping allowed:** β with α, γ with δ, ε with ζ. Never overlap two infrastructure phases (0 + anything) or two launch phases (ι + anything).

---

## 18. References

- `docs/ENGINEERING_ROADMAP.md` — 10-phase strategic roadmap
- `docs/PHASE_HANDOFF.md` — Phase 1→2 handoff with current state
- `docs/PATH_TO_LAUNCH.md` — Concise launch path
- `docs/BLUEPRINT_REALIZATION_INVENTORY.md` — Feature inventory vs strategic blueprint
- `docs/DESIGN_SYSTEM.md` — UI tokens and component patterns
- `docs/SECURITY_ROTATION_RUNBOOK.md` — Key rotation procedures
- `docs/STRIPE_TEST_SETUP.md` — Stripe configuration notes
- `docs/INFRA_INTEGRATION_REPORT.md` — Worker tier architecture
- `docs/LUA_AGENTS.md` — Lua agent system docs
- `worker/GO_LIVE.md` — Worker deployment checklist
- `src/App.tsx` — All route definitions (65+ views, 115 API routes)
- `src/lib/api.ts` (2240 lines) — Full API client
- `supabase/migrations/001–117` — Complete database schema evolution
- `src/server/lua-agents/` — 24 strategic AI agents
- `src/styles/tokens.ts` — Design tokens (single source of truth)
