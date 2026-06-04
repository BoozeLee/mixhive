# MixHive — 10-Phase Engineering Roadmap

> Engineering execution plan that turns the business roadmap
> (`mixhive+beehivestudios/mixhive-roadmap.md`, phases 16–20) into buildable work.
> Grounded in a gap analysis as of migration `082` (2026-06-04).
>
> **State of play:** Phase 16 is ~80% shipped — Hive Story editorial, agent-marketplace
> paid tiers, PWA push, gear + agent marketplace, and Collab Quest XP all landed. The
> self-hosted worker tier (Go audio worker + Ruby scheduler + Podman) exists in `worker/`
> and is live-verified, but isn't yet running continuously on the box. The real remaining
> work: **payout flows, activating the dormant audio pipeline, messaging, scene pages, the
> Beehive Studio bridge, live streaming, observability, and scale.**
>
> Phases are ordered by ROI/dependency; each is independently shippable and ends with
> tsc+build clean, tests green, a deploy, and a KPI check against the business roadmap.

---

## Phase 1 — Activate the Worker Tier & Audio Pipeline  *(highest ROI — fixes silent prod breakage)*

Today `src/lib/job-processor.ts` only starts in development, so uploaded mixes **never get
waveforms/BPM/key/mood in production** and most `vercel.json` crons don't fire on Hobby.

1. Deploy `worker/compose.yaml` on the self-hosted box (Podman) with the Supabase
   service-role env; enable the systemd Quadlet (`worker/mixhive-audio-worker.container`) for auto-restart.
2. Confirm the Go audio worker drains `audio_jobs` end-to-end on a real upload
   (waveform_data + duration land on `mixes`).
3. Remove/disable the dev-only `JobProcessor` start in `src/lib/job-processor.ts` so there's
   one source of truth (the Go worker).
4. Add `bpm_key_mood` real analysis to the Go worker (aubio/DSP) replacing the
   `src/lib/audio-processing.ts` placeholder.
5. Add `tracklist` fingerprinting as a queued job type with a clear "pending analyzer" result
   (no silent drop).
6. Run the Ruby scheduler (`worker/scheduler/`) to fire the Hobby-blocked crons
   (nft-sync, push-sender, notification-prioritizer) on real intervals.
7. Implement the two stub crons `/api/cleanup` and `/api/analytics/daily`
   (orphan cleanup; daily aggregate rollups).
8. Add a Cloudflare Tunnel (or Tailscale) so Vercel webhooks/health can reach the box;
   document the inbound path.
9. Add worker health metrics (jobs processed, failures, queue depth) behind
   `/api/health/worker` for the scheduler to ping.
10. Backfill: enqueue waveform jobs for all existing mixes missing `waveform_data`; verify the
    queue drains.

## Phase 2 — Complete Monetization (Payouts & Escrow Loop)

Buyers can pay; sellers/creators can't cash out — Stripe **Connect** is missing.

1. Stripe Connect onboarding: `/api/stripe/connect/onboard` → account link; store
   `stripe_account_id` on profiles (new migration).
2. Gate gear listing + paid-agent publishing on a connected, payouts-enabled Stripe account.
3. Extend `src/app/api/marketplace/stripe-webhook` to release gear escrow to the seller on
   capture (Connect transfer), not just `paid_escrow`.
4. Buyer "confirm received" action releases gear escrow; auto-release after N days.
5. Agent-sale payouts (70/30) via Connect transfer on `checkout.session.completed`.
6. Creator **Earnings** dashboard tab: pending, released, lifetime, payout history.
7. Dispute/refund handling (`charge.dispute.created`) → mark transaction, notify both parties.
8. Platform-fee ledger table + reconciliation/finance export (for Paulien).
9. Paid boosts for gear listings (€2–5/30d): Stripe one-time + `boosted_until` + ranking weight.
10. E2E + webhook tests for the full money loop (onboard → list → buy → escrow → release → payout).

## Phase 3 — Trust, Identity & Moderation

Verification UI exists (`src/components/VerificationBadgeSystem.tsx`, `/admin/verification`)
but there's **no DB persistence or approval workflow**.

1. `verification_badges` migration (type, status, granted_by, reason, granted_at) + RLS.
2. Wire the admin approval flow in `/admin/verification` (approve/reject → persist + notify).
3. "Trusted seller" badge auto-granted after N successful, dispute-free sales.
4. Surface badges everywhere: profile, mix cards, gear listings, agent cards.
5. Moderation: route `moderation/signals` into an admin review queue with actions (warn/hide/ban).
6. Report buttons across mixes/buzzes/gear/profiles feeding the signals queue.
7. Abuse guards: rate-limit signups, uploads, buzzes (extend `social/rate-limit`).
8. Disposable-email/domain reputation check on signup.
9. Audit + tighten RLS on all Phase 15–16 tables (marketplace, quests, hive_story, push).
10. Add `SECURITY.md`; run `npm audit` and ticket the known advisories.

## Phase 4 — Messaging & Real-time Social  *(Phase 17 core — currently absent)*

No DM/conversation system exists in schema or API — a major social gap.

1. Schema: `conversations`, `conversation_members`, `messages` migrations + RLS (1:1 + group).
2. API: create/list conversations, send/list messages, mark-read (`/api/conversations`, `/api/messages`).
3. Realtime: Supabase channel per conversation (presence + new-message broadcast); reuse `useRealtime`.
4. Inbox view (`/messages`) + thread view; unread badges in nav (extend `NotificationsBell`).
5. "Message" entry points from gear listings, quest applications, and profiles.
6. Push + in-app notifications on new message (extend push-sender + `notificationStore`).
7. Typing indicators + read receipts via presence/broadcast.
8. Attachments: share a mix/gear listing as a rich card in a message.
9. Block/mute integration (reuse `user_blocks`) so blocked users can't DM.
10. E2E tests (send/receive/read/block) + mobile-overflow pass on the new views.

## Phase 5 — Scene Pages & Discovery 2.0  *(Phase 17)*

`SceneRadar` is a trend tool, not persistent scene communities.

1. Schema: `scenes` (slug, name, genre, city, region) + `scene_members` + `scene_follows`.
2. Auto-derive scene membership from profile genres + location; allow manual join.
3. Scene page `/scene/:slug` — header, member grid, filtered scene feed (mixes/buzzes/quests).
4. Scene index `/scenes` (browse by genre/city) with `Reveal`/`HiveCard` chrome.
5. Link Scene Radar output into real scene pages (close the loop).
6. Scene leaderboards (top mixes/artists this month).
7. Partner/label "guild" scene variant (co-branded landing — Phase 17 partnership angle).
8. Geo/genre filters on Search + Discover; persist popular-search lanes per scene.
9. Scene-scoped notifications (new mix in your scene, scene event posted).
10. SEO: SSR scene metadata + OG images; sitemap of scene pages.

## Phase 6 — Creator Studio: Portfolio, Analytics & EPK 2.0  *(Phase 17→18)*

Portfolio links store but don't embed; advanced analytics is research-only.

1. SoundCloud/Bandcamp/YouTube oEmbed previews on profiles + EPK (live link validation).
2. Advanced analytics schema: plays/likes/followers timeseries rollups via the daily cron.
3. Analytics dashboard: growth charts, top mixes, audience geography, referral sources.
4. Pro-artist subscription gate (Stripe) unlocking analytics + verified styling (Phase 18 revenue).
5. EPK 2.0: themes, embedded player, press quotes, downloadable one-sheet PDF.
6. Mix insight panel surfacing the worker's BPM/key/mood + similar-mix recommendations.
7. "Best time to post" + agent-driven growth suggestions (reuse strategic agents).
8. Profile completeness meter + onboarding nudges tied to discovery boosts.
9. Public profile OG/SEO + shareable mix cards (image gen from optimized assets).
10. Tests + Lighthouse pass on profile/dashboard/EPK at 320/768/1440.

## Phase 7 — Beehive Studio ↔ MixHive Bridge  *(Phase 16/19 flagship — zero code today)*

The ecosystem flywheel (Create → Distribute → Discover) is unbuilt; no "beehive" code exists.

1. Bridge contract: authenticated `/api/bridge/publish` accepting a rendered track + metadata.
2. Service-to-service auth (signed token/shared secret) between Beehive Studio and MixHive.
3. Publish flow: Beehive export → upload to `mix-audio` → create mix → enqueue audio job → return URL.
4. Round-trip "Open in Beehive Studio" deep link from a MixHive mix (stems/project handoff).
5. Agent collaboration: expose MixHive Lua agent outputs (Scene Radar, trend) to Beehive sessions.
6. Shared identity: Sign-in with MixHive / OAuth so one account authorizes Beehive.
7. Track provenance: tag + "Made in Beehive Studio" badge on bridged mixes.
8. Webhook back-channel: Beehive notifies MixHive on render-complete / collab events.
9. Rate limits, quotas, error handling, and observability on both sides of the bridge.
10. End-to-end harness simulating the create→distribute→discover loop.

## Phase 8 — Live & Streaming  *(Phase 18, infra P4)*

No HLS/RTMP/listening-party code; the Go streaming gateway is the planned P4.

1. Stand up a Go streaming/WebSocket gateway in `worker/` under Podman.
2. Listening-party schema: `listening_parties`, `party_participants`, queue/now-playing state.
3. Synchronized playback: gateway broadcasts position; clients follow the host.
4. Live chat overlay (reuse the Phase 4 messaging realtime layer).
5. Host controls (queue mgmt, skip, invite) + capacity limits.
6. Live DJ set ingest (RTMP→HLS); viewer HLS playback.
7. Party discovery ("live now") on Discover + scene pages.
8. Recording → auto-create a mix from a finished live set (enqueue audio job).
9. Push/notification when a followed artist goes live.
10. Load-test the gateway (concurrent listeners) + graceful degradation/fallback.

## Phase 9 — Quality, Performance, Observability & Accessibility  *(cross-cutting hardening)*

1. Raise E2E coverage to every route tier (add payout, messaging, scenes, streaming specs).
2. Unit tests for the Go worker (job claim/retry) and the bridge contract.
3. CI: tsc + build + jest + Playwright on every PR (`.github/workflows`); block on red.
4. Lighthouse budget gate (≥90 perf/a11y/SEO/best-practices) on `/`, `/feed`, `/hub`, `/help`.
5. Error monitoring: confirm Sentry server+client; add the worker tier to it.
6. Structured logging + real `/api/health` aggregate (db, storage, redis, worker, queue depth).
7. Performance: route prefetch-on-hover, image/AVIF audit, bundle analysis, cache-header review.
8. Accessibility sweep: focus states, ARIA, keyboard nav, `prefers-reduced-motion` everywhere.
9. Rate-limit + Vercel firewall/WAF rules on auth + write endpoints; bot protection.
10. Disaster recovery: verified Supabase backups, worker-box failure runbook, idempotent job replay.

## Phase 10 — Scale, Internationalization & Launch Readiness  *(Phase 18–20)*

1. i18n (next-intl is already a dep): extract strings, ship EN + NL, then DE/FR.
2. Label services tier: A&R dashboard, roster analytics, branded guild pages, retainer billing.
3. B2B quest posting: brand accounts, paid quest listings (€20–100), talent-discovery flows.
4. NFT quest-completion tokens (Base L2) + smart-contract rev-share for commercial quests.
5. Mobile: PWA-first hardening (installability, offline shell) → evaluate a React Native wrapper.
6. Festival/partner integrations: lineup import, aftermovie quests, sponsored categories.
7. Multi-region performance: CDN audit, read replicas/edge caching for hot feeds.
8. Data/ML: recommendation quality loop (A/B), embedding versioning (closes the BLUEPRINT gap).
9. Billing maturity: subscription management, dunning, invoices, VLAIO/financial reporting.
10. Launch readiness: security audit, load tests, demo env, Series-A data room + metrics dashboard.

---

## Sequencing & dependencies
- **Do first:** Phase 1 (dormant audio/crons = silent breakage today) and Phase 2 (close the
  revenue loop). These unblock the business roadmap's Phase 16 KPIs.
- Phases 3–6 deliver the Phase 17 social/trust/discovery surface.
- Phases 7–8 are the Phase 18 flagships (Beehive flywheel, live streaming).
- Phases 9–10 are continuous hardening + the Phase 19–20 scale push.

## Verification (every phase)
`npx tsc --noEmit && npm run build && npm run e2e`; manual smoke of the new surface at
320/768/1440; for backend work exercise the live path via the Supabase service role or the
worker tier; deploy a preview, verify, then `--prod`. Close each phase with a KPI check
against `mixhive+beehivestudios/mixhive-roadmap.md`.

---
*Generated 2026-06-04. Companion docs: `INFRA_INTEGRATION_REPORT.md` (worker tier),
`BLUEPRINT_REALIZATION_INVENTORY.md` (feature status).*
