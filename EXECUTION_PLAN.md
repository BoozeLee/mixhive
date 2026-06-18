# MixHive Execution Plan (8 Phases)

Saved from conversation at `2af6a54` on `p10-i18n-sweep`.

## Phase 1 ✅ P10 i18n — Translate FR/NL Pilot Strings
**Done** — Login, Register, Feed, Upload translated in `messages/fr.json` (+85) and `messages/nl.json` (+41). 280 tests pass, `tsc --noEmit` clean. Committed `2af6a54`.

---

## Phase 2 ⬜ P1 Design System — Hex→Token Sweep
**Scope:** 16 views with 33 hardcoded hex values (from prior audit)
- **Trivial (17 drops):** `Leaderboard`, `PressKitStudio`, `CollabSessionRoom`, `CollabQuests`, `CollabQuestDetail`, `Settings`, `MessageThread`, `NotFound`, `BuzzDetail`, `Styleguide` — exact token matches
- **Close match (5):** `Hub.tsx` (#ffd84a → `accentBrightest`), `QuestDetail` (#6ccc6c → `success`), `HelpArticle` (#0b0b08 → `surfaceMuted`, #e8dcae → `accentBrightest`)
- **Missing token (6):** `Hub` (#e8b830, #d4a830), `AdminModeration` (#fb923c) — add tokens or use nearest
- **8-digit alpha (2):** `Hub` → `withAlpha()`
- **Skip:** `Register` Google brand colors (intentional)
- **Risk:** Low. Visual diffs possible in Hub and HelpArticle.

---

## Phase 3 ⬜ P4 States — Empty/Loading/Error Sweep
**Survey needed** first — which lower-traffic views lack states. Candidates from route tree: `AgentsGallery`, `AuthCallback`, `DevLogin`, `EmbedMix`, `HiveComposer`, `HiveStory`, `HiveStoryLanding`, `HiveStoryIssue`, `LiveRituals`, `MythicSessionRoom`, `PublicPressKit`, `SceneDetail`, `Scenes`, `PressKitStudio`.
- **Pattern:** Add `<EmptyState>`, loading skeleton, error boundary per existing pattern.
- **Risk:** Low-medium.

---

## Phase 4 ⬜ P9 Privacy — Deletion Cron + Retention
**What exists:** Queue endpoint, export endpoint, `deletion_requests` table, consent tracking.
**What's missing (critical):**
1. Service-role hard-delete endpoint — cascades delete across ~20 tables, calls `auth.admin.deleteUser()`, cleans up Storage
2. Add to `vercel.json` crons + Ruby scheduler
3. Cancel endpoint
4. Status UI in Settings
5. Regenerate `database.types.ts`
6. Anonymization for retained records
- **Envs needed:** `SUPABASE_SERVICE_ROLE_KEY`
- **Risk:** Medium-high.

---

## Phase 5 ⬜ P11 Creator Studio — Analytics 2.0 + Monthly Recap Email
**Need research:** What "2.0" means vs current `ProfileAnalyticsDashboard`. Likely: enhanced analytics API, monthly recap email cron, UI improvements.
- **Risk:** Medium.

---

## Phase 6 ⬜ P12 Beehive Publish Bridge
**Need research:** Desktop client API contract. New endpoint for desktop push/pull + auth scheme.
- **Risk:** Medium. Depends on desktop client.

---

## Phase 7 ⬜ P14 Pre-Launch Gate — Stripe TEST + Subscriptions
**Marketplace escrow/Connect payouts work.** Subscriptions are 100% absent.
**Must build:**
1. `subscription_tiers` + `user_subscriptions` tables (new migration)
2. Stripe Customer creation route
3. Checkout Session with `mode: 'subscription'`
4. Billing Portal session endpoint
5. Webhook handlers: `customer.subscription.*`, `invoice.*`
6. Tier-gating middleware (agent test-run, AI, analytics)
7. Pricing page UI (`/pricing`)
8. Billing management UI (`/account/billing`)
9. Stripe test-mode account + products/prices
10. End-to-end test flow
- **Envs needed:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET` (test), `STRIPE_PRICE_PRO_MONTHLY`, etc.
- **Risk:** High. Large surface area.

---

## Phase 8 ⬜ Update Basecamp
After each phase, post progress to Basecamp message thread #9996913146.

---

## Recommended Order
```
P10 translations  ────▶  (done ✅)
P1 hex→token      ────▶  (fast, reduces tech debt)
P4 states         ────▶  (UX polish)
P9 deletion cron  ────▶  (legal)
P14 subscriptions ────▶  (blocking launch)
P11 Creator       ────▶  (nice-to-have)
P12 Beehive       ────▶  (depends on desktop)
```

## Sidebar: Stripe Keys
Documented as COMPROMISED. Not rotating — moved on.
