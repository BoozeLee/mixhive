# MixHive — Engineering Roadmap

> Execution plan turning the business roadmap (phases 16–20) into buildable work.
> **Grounded as of migration `104` (2026-06-18), backend = the BeeHiveStudio Supabase
> project (`ljdolmqytncxhgojqguh`, the shared MixHive+Beehive database).**
>
> Each forward phase is independently shippable and closes with: `tsc` + `build` clean,
> tests green, deploy + smoke, and a KPI check against the business roadmap.

---

## State of play — what's shipped

Core social + creator platform is live: feed, profiles, follows, reposts, mentions,
notifications, **on-platform messaging**, realtime collab sessions, NFTs (Base L2),
Scene Radar, Press Kit/EPK, Opportunities, MythicNode, Hive Story, PWA push.

Marketplaces + money: **gear marketplace with Stripe Connect escrow**, payout ledger,
auto-release cron, dynamic platform fees, listing boosts; **agent marketplace** with paid
70/30 tiers; trusted-seller badges.

Progression: **XP + reputation system with full UI** — hex level badge, XP-to-next bar,
reputation meter, `/leaderboard`, quest-completion XP.

AI-native layer (this cycle): **AI-Band provenance** — a published track records the AI
agents that co-produced it (`mix_agent_credits`), with a credits panel, "AI Band" badge,
and the atomic `publish_mix_with_credits` RPC. **Agents as Artists** — agents are
followable entities (`ai_agents` + `ai_agent_follows`) with a public artist page at
`/ai-band/agent/:slug` (stats, discography, follow).

Audio worker (`worker/`): Go worker computes **waveform + duration + BPM + energy + mood +
musical key** (stdlib chroma/Krumhansl-Schmuckler), `--selftest`, `/api/health/worker`, a
backfill script, and a `GO_LIVE.md` runbook — **built & verified, not yet running on the box**.

Tooling: `npm run visual` (bundled-Chromium hydrated screenshot + overflow/console check),
`npm run preview` fixed for the `output:'standalone'` build, dev-only CSP for local browsers.

Migration: repointed off the dead `vlaio-vanderbouw` project to **BeeHiveStudio** (schema
current through 104, all storage buckets present).

---

## Phase α — Audio worker go-live + production cutover *(highest ROI: fixes broken prod)*
The old DB is dead, so the live site + the audio pipeline are down until cutover.
1. Execute `worker/GO_LIVE.md` on the box: Podman compose + rootless systemd Quadlets for the
   Go worker + Ruby scheduler; cloudflared tunnel for `/api/health/worker`.
2. Point **Vercel production env** at BeeHiveStudio (URL + anon + service-role) and redeploy.
3. Configure **Google OAuth** on the new project (redirect `…/auth/v1/callback`) — email/magic
   link works meanwhile.
4. Run `scripts/enqueue_waveform_backfill.mjs --commit`; confirm the queue drains
   (waveform/BPM/key land on `mixes` + `audio_features`).
5. Rotate the exposed Supabase PAT; verify scheduler fires the Hobby-blocked crons.

## Phase β — AI-Band discovery *(continues the unique wedge)*
Make agent-artists findable: `/ai-band` index + **agent leaderboard** (by followers/plays,
reuse the `/leaderboard` pattern), nav entry, and surface "AI Band" in Discover/Search.
Optional: agent search, "agents to feature," provenance filters in the feed RPC.

## Phase γ — Adoption ritual *(first real users + €)*
Invite-only "first 50 DJs" onboarding ceremony + Honey-Drop share card; seed 5 gear + 3 collab
quests; a weekly synchronous **"Ritual Drop"** listening event (reuse collab-session realtime);
trigger the first paid event; switch subscriptions on. Targets the Phase-16 KPIs (50 reg / 20
MAU / >€0).

## Phase δ — Beehive ↔ MixHive flywheel completion
The MixHive side (ingest + provenance + agent-artists) is built; finish the loop: device-auth
**"Connect Beehive"** handshake, real publish-with-provenance from the Beehive app, "Open in
Beehive" deep link, and trend/audience data flowing back to Beehive agents.

## Phase ε — Scene pages & discovery 2.0
Persistent scene communities: `scenes`/`scene_members`/`scene_follows`, `/scene/:slug` + `/scenes`,
auto-membership from genre/location, scene feeds + leaderboards, SSR/OG/SEO, scene-scoped notifs.

## Phase ζ — Creator studio: portfolio, analytics, EPK 2.0
oEmbed previews (SoundCloud/Bandcamp/YT), plays/likes/followers timeseries via the daily cron,
analytics dashboard, mix-insight panel surfacing the worker's BPM/key/mood, EPK 2.0 themes/PDF,
Pro-artist subscription gate.

## Phase η — Live & streaming
Go streaming/WebSocket gateway (Podman), `listening_parties` schema, synchronized playback + live
chat, RTMP→HLS ingest, "live now" discovery, recording→auto-mix, go-live notifications.

## Phase θ — Hardening: quality, perf, observability, a11y, security
E2E across every route tier + Go-worker unit tests; CI gate (tsc+build+jest+Playwright); Lighthouse
budget; real `/api/health` aggregate + worker in Sentry; perf (prefetch, AVIF, bundle, caching);
a11y sweep; WAF/rate-limit/bot rules; verified backups + worker-box DR runbook.

## Phase ι — Scale, i18n & launch readiness
Finish i18n (EN/NL shipping, then DE/FR — sweep in progress); label/A&R tier; B2B paid quest posting;
NFT quest-completion tokens + smart-contract rev-share; mobile PWA hardening → RN wrapper; multi-region
caching; recommendation quality loop; billing maturity (VLAIO reporting); security audit + Series-A data room.

---

## Sequencing
**Now:** Phase α (cutover repairs broken prod + the dormant audio pipeline). **Next:** β (cheap,
extends the wedge) then γ (adoption + first €) — these hit the Phase-16 KPIs. δ–ζ build the Phase-17/18
flywheel + social/creator surface; η–ι are the Phase-18→20 scale push and continuous hardening.

## Verification (every phase)
`npx tsc --noEmit && npm run build && npx jest`; `npm run visual <url> <routes>` at 320/768/1440;
exercise backend via the service role or worker; deploy preview → verify → `--prod`; KPI check.

---
*Updated 2026-06-18 (migration 104, BeeHiveStudio backend). Companion: `BLUEPRINT_REALIZATION_INVENTORY.md`.*
