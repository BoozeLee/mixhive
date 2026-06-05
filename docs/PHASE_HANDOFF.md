# MixHive — Phase Handoff & Integration Report

> **Purpose:** Seed a fresh Claude Code conversation with the complete current state, the full
> engineering roadmap, and the next phase's execution plan — so a new session can resume with zero
> re-derivation. Read this first, then the linked docs.
>
> **Date:** 2026-06-05 · **Repo:** `/home/kilisan/dj-nef-website/mixhive` · **Prod:** `https://mixhive.vercel.app`
> **Status:** Phase 1 shipped + deployed + verified. Phase 2 planned, not started.

---

## 0. TL;DR

- **Phase 1 (Activate Worker Tier & Audio Pipeline) is DONE and live in production.** The dormant
  audio queue is now drained by a self-hosted Go worker that computes real BPM/energy/mood; the two
  stub crons are implemented; a worker-health endpoint is live; the worker tier (Go audio worker +
  Ruby scheduler + Redis) runs persistently under Podman on the local box.
- **Phase 2 (Complete Monetization — Stripe Connect payouts) is the next phase**, fully planned in
  `.claude/plans/get-back-to-the-cheerful-owl.md` and summarized in §4 below.
- **Two honest open items** carry into Phase 2 (see §5): `CRON_SECRET` is unset in Vercel (crons are
  currently open), and the BPM estimator can hit octave/sub-harmonic errors on rolling-bassline genres.

---

## 1. What is deployed right now (Phase 1)

**App (Vercel, prod `https://mixhive.vercel.app`):**
- `src/lib/job-processor.ts` — removed the dev-only auto-start; the Go worker is now the **single**
  consumer of `audio_jobs` (previously prod never processed jobs).
- `src/app/api/cleanup/route.ts` — implements the declared-but-missing cron (CRON_SECRET-gated):
  deletes failed `audio_jobs` >7d, requeues stuck `processing` jobs >1h.
- `src/app/api/analytics/daily/route.ts` — implements the second stub cron: snapshots
  `get_hive_stats()` into `daily_platform_stats` (one row/day).
- `src/app/api/health/worker/route.ts` — read-only queue depth / pending / processing / failed /
  last_completed_at. Live now: returns `{"ok":true,"queue_depth":0,...}`.
- `scripts/backfill-waveforms.mjs` — idempotent waveform-job backfill (ran clean, 0 due).
- Migration **083** `daily_platform_stats` — applied to live Supabase.
- Commit: `a34a838 feat(phase1): activate audio pipeline …`.

**Worker tier (Podman, local box — "the box"):**
| Container | Image | Role |
|---|---|---|
| `mixhive-audio` | `localhost/mixhive-audio-worker:latest` | drains `audio_jobs`, ffmpeg → waveform + duration + **BPM/energy/mood** → `mixes` + `audio_features` |
| `mixhive-sched` | `localhost/mixhive-scheduler:latest` | fires Hobby-blocked crons on real intervals; **LLM crons disabled** (`IV_STRATEGIC`/`IV_NOTIF` huge) per zero-budget ethos |
| `mixhive-redis-1` | `redis:7-alpine` | queue/cache |

- Run config: `--restart unless-stopped --network host --env-file ~/.config/mixhive/worker.env`.
- `worker.env` keys (names only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUDIO_BUCKET`,
  `POLL_INTERVAL_MS`, `MAX_CONCURRENT`.
- **Go worker analysis** (`worker/audio/`, stdlib-only): BPM via onset-envelope (RMS-flux)
  autocorrelation + parabolic interpolation over lags [60,180]; energy = RMS loudness;
  `classifyMood(bpm,energy)` → peak/groove/ambient/transition; `upsertAudioFeatures()` writes
  `bpm/energy/mood/source=go-worker/model=ffmpeg-autocorr-v1` (musical key left null — chroma analyzer deferred).
- **Live verification:** a real psytrance upload round-tripped end-to-end in ~32s; `audio_features`
  populated (`bpm`, `energy`, `mood`). Synthetic tones validated: 128bpm→126.4, 174bpm→172.0.

**Deferred (needs user action, not code):** named Cloudflare tunnel for inbound health — config is
committed at `worker/cloudflared-config.yml`; the tunnel login is the user's step. Poll-only works
today (the worker reaches Supabase outbound; no inbound required for the audio loop).

---

## 2. How to operate / resume the worker tier

```bash
# status
podman ps -a --filter name=mixhive --format "{{.Names}} | {{.Image}} | {{.Status}}"
# logs
podman logs --tail 50 mixhive-audio
podman logs --tail 50 mixhive-sched
# rebuild + restart the audio worker after Go changes
cd worker/audio && podman build -t localhost/mixhive-audio-worker:latest .
podman rm -f mixhive-audio && podman run -d --name mixhive-audio --restart unless-stopped \
  --network host --env-file ~/.config/mixhive/worker.env localhost/mixhive-audio-worker:latest
# selftest the ffmpeg/BPM pipeline with no network
go run ./worker/audio --selftest path/to/file.mp3
# live health
curl -s https://mixhive.vercel.app/api/health/worker
```

---

## 3. The full Engineering Roadmap (10 phases)

Source of truth: `docs/ENGINEERING_ROADMAP.md` (gap-analysis grounded, 10+ steps each).

1. **Phase 1 — Activate the Worker Tier & Audio Pipeline** ✅ *DONE (this handoff)*
2. **Phase 2 — Complete Monetization (Payouts & Escrow Loop)** ⬅ *next; see §4*
3. **Phase 3 — Trust, Identity & Moderation** (incl. the Phase-1 `CRON_SECRET` security fix)
4. **Phase 4 — Messaging & Real-time Social** (Phase 17 core — currently absent)
5. **Phase 5 — Scene Pages & Discovery 2.0** (Phase 17)
6. **Phase 6 — Creator Studio: Portfolio, Analytics & EPK 2.0** (Phase 17→18)
7. **Phase 7 — Beehive Studio ↔ MixHive Bridge** (Phase 16/19 flagship — zero code today)
8. **Phase 8 — Live & Streaming** (Phase 18; Go streaming gateway is the worker-tier's P4 future role)
9. **Phase 9 — Quality, Performance, Observability & Accessibility** (cross-cutting hardening)
10. **Phase 10 — Scale, Internationalization & Launch Readiness** (Phase 18–20)

Infra/worker-tier rationale and history: `docs/INFRA_INTEGRATION_REPORT.md` (P0–P4; P0–P2 done).

---

## 4. Phase 2 — execution plan (next)

Full plan: `.claude/plans/get-back-to-the-cheerful-owl.md`. Goal: **close the money loop** so revenue
is collectable (roadmap Phase 16 "Revenue >€0"). Buyers can pay today (gear escrow + agent checkout
exist) but sellers/creators **can't cash out** — Stripe **Connect** is unwired.

**Grounding from the live schema:**
- `profiles` has **no** `stripe_account_id` → needs migration **084**.
- `equipment_transactions` already has the full escrow lifecycle (`transaction_state`, `shipped_at`,
  `tracking_number`, `delivered_at`, `dispute_opened_at`, `dispute_notes`, `resolved_at`, `platform_fee_pct`).
- `src/app/api/marketplace/stripe-webhook/route.ts` handles `checkout.session.completed` +
  `payment_intent.amount_capturable_updated` but does **no Connect transfer** (no payout).
- `lua_agent_package_purchases` (migration 080) tracks agent sales w/ 70/30 split but no payout.

**Migrations:** `084_stripe_connect_accounts` (`profiles.stripe_account_id`, `payouts_enabled`);
`085_marketplace_ledger` (`platform_fee_ledger` + `equipment_listings.boosted_until`).

**Code (10 steps):** (1) Connect onboarding + status; (2) gate listing/publish on `payouts_enabled`;
(3) release gear escrow → seller via Connect transfer + ledger; (4) buyer "confirm received" +
scheduler auto-release; (5) agent 70/30 payouts; (6) earnings dashboard tab; (7) disputes/refunds
freeze + notify; (8) fee-ledger finance export (CSV for Paulien); (9) paid gear boosts; (10) Stripe
test-mode money-loop E2E + webhook tests.

**Ops (user, Stripe dashboard):** enable Connect (Express) + branding/payout schedule; add
`payment_intent`/`transfer`/`charge.dispute`/`charge.refunded` to the webhook; test-mode keys for CI;
**set `CRON_SECRET` in Vercel** before the auto-release scheduler goes live.

**Note:** the `stripe`, `supabase`, and `vercel` MCP plugins are now connected in this environment —
Phase 2 can use them directly (e.g. `stripe` for Connect account/transfer testing in test mode,
`supabase` `apply_migration` for 084/085).

---

## 5. Open items / honest limits (carry into Phase 2/3)

1. **`CRON_SECRET` is unset in Vercel → cron routes are currently open.** This is the *existing*
   platform pattern (`if (cronSecret && …)` in every cron), not a Phase-1 regression, but it's a real
   exposure. **Hard prerequisite** before Phase 2's auto-release scheduler. Belongs to Phase 3 security.
2. **BPM octave/sub-harmonic error** on rolling-bassline genres (a psytrance test read 93.8 vs ~140).
   Genuinely computed; fine for most 4/4 house/techno. A comb-filter / octave-correction refinement is
   a future improvement. Musical key is null pending a chroma analyzer.
3. **Single-box SPOF** for the worker tier; acceptable at current scale; jobs are idempotent so a
   restart re-drains the queue.

---

## 6. Kickoff prompt for the new conversation

```
Resume MixHive. Read docs/PHASE_HANDOFF.md first — it has the full state, roadmap, and Phase 2 plan.

State: Phase 1 (worker tier + audio pipeline) is shipped and live on https://mixhive.vercel.app.
Go worker + Ruby scheduler + Redis run under Podman on the local box (containers mixhive-audio /
mixhive-sched / mixhive-redis-1). Real BPM/energy/mood land in audio_features; migration 083 applied.

Next: execute Phase 2 — Complete Monetization (Stripe Connect payouts). The detailed plan is in
.claude/plans/get-back-to-the-cheerful-owl.md and docs/PHASE_HANDOFF.md §4. Start with migrations
084/085, then Connect onboarding, then the gear-escrow release transfer.

Constraints: zero budget for cloud AI (self-host only); do NOT add paid AI APIs (Stripe is the
revenue mechanism, not an AI API — it's fine). Use the connected stripe/supabase/vercel MCP plugins.
Before the auto-release scheduler goes live, set CRON_SECRET in Vercel (crons are currently open).
End turns in one sentence; no recaps.
```

---

*Bottom line: the dormant audio pipeline is now genuinely active in production, and the next move is
to make the marketplace actually pay sellers. Everything needed to resume cold is in this file plus the
two linked docs.*
