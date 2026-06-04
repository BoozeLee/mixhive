# MixHive Infrastructure Integration Report
### Ruby · Go · Podman + Lazy→Active Execution

> **Purpose:** Hand-off document to seed a fresh Claude Code conversation. It answers
> "where do Ruby, Go, and Podman genuinely belong in MixHive, and which executions are
> lazy/dormant that should be made active?" — honestly, with file-path evidence.
>
> **Date:** 2026-06-04 · **Repo:** `/home/kilisan/dj-nef-website/mixhive` · **Status:** research/plan, no code changed.

---

## 0. TL;DR — the honest verdict

1. **On the Vercel-only path at indie scale, Ruby/Go/Podman are not needed.** MixHive is
   **IO-bound** (LLM calls, Supabase queries, external APIs), not CPU-bound. There is no
   DSP, graph-traversal, or numerical hot loop in Node today. Adding three runtimes to chase
   performance that isn't the bottleneck would be **polyglot sprawl**.

2. **The real problem is not "lazy loading" — it's *dormant execution*.** Several pieces of
   work are *coded but never run* because Vercel serverless cannot host long-lived processes.
   That is the genuine defect worth fixing.

3. **The justified move:** stand up one small **self-hosted "Active Worker Tier"** (Podman, on
   the local box already running the BSL engine) that runs the always-on jobs Vercel can't —
   and give **Go** and **Ruby** exactly **one strong role each** inside it. This fits the
   documented zero-budget / self-host ethos.

4. **Do NOT make React route lazy-loading eager.** That is *correct* laziness; eager-loading
   24 route chunks into the initial bundle would *hurt* load performance. The right "non-lazy"
   UX is route **prefetch-on-hover**, not bundling everything up front.

**Relative fit:** Podman **STRONG** · Go **STRONG (one service)** · Ruby **DEFENSIBLE (one service, weakest of the three)**.

---

## 1. Current-state audit — the genuine dormant / lazy gaps

All paths relative to repo root.

### 1.1 Dormant background worker — the biggest gap
- `src/lib/job-processor.ts` and `src/lib/audio-processing.ts` define a polling
  `JobProcessor` / `AudioProcessingWorker` (poll `audio_jobs` every 5s, max 3 concurrent,
  spawn `ffmpeg` for waveform/BPM/key/mood).
- **They are never instantiated or started in production.** There is no `jobProcessor.start()`
  on any server boot path (Vercel has no persistent process to host it).
- Jobs are **enqueued** by `src/app/api/audio/process/route.ts` into the `audio_jobs` table
  but **nothing consumes them** → uploaded mixes can sit without waveforms/metadata forever.
- **This is the single highest-value fix.**

### 1.2 Crons that never fire on Hobby
- `vercel.json` declares 7 crons, but **Vercel Hobby runs at most one cron per day**.
- Hourly/extra crons effectively **do not run**: `nft-sync` (`0 * * * *`),
  `push-sender` (`0 9 * * *`), `notification-prioritizer` (`0 8 * * *`).
- Implementations exist under `src/app/api/cron/*` — they're simply never triggered on Hobby.

### 1.3 Cold-start-heavy paths
- `api/lua-agent/run.py` — Python (Lupa) on Fluid Compute, 30s cap, multi-second cold start.
- `src/app/api/audio/process/route.ts` — spawns system `ffmpeg`; subprocess + binary init is slow.

### 1.4 Declared-but-unimplemented stubs
- `/api/cleanup` (`0 2 * * *`) and `/api/analytics/daily` (`0 0 * * *`) appear in `vercel.json`
  with **no route implementation**.

### 1.5 Correct laziness — leave it alone
- 24 `React.lazy(() => import())` route splits in `src/App.tsx` — correct for an SPA.
- Supabase Realtime (managed WSS) — no backend socket to host; appropriate.
- In-process wasmoon Lua **pool** (`src/server/lua-agents/LuaRuntime.ts`, 4 warm engines) —
  faster than containers for 2s-wall-clock agents; appropriate.

---

## 2. Role assignment — expertise → use case

### 2.1 Podman — **STRONG fit (the host)**
- **Role:** rootless, daemonless container engine running the self-hosted **Active Worker Tier**
  on the existing local box, alongside the BSL FastAPI engine.
- **Why it fits:** no Docker daemon, no licensing, rootless security, systemd **Quadlet** units
  for restart-on-crash — ideal for a zero-budget always-on box. A `Dockerfile` + `docker-compose.yml`
  already exist in the repo and are **OCI-compatible → run under Podman unchanged**.
- **Hosts:** the Go audio worker, the Ruby scheduler/queue, a warm Lua runtime, and Redis.
- **Verdict:** the clearly-justified pick.

### 2.2 Go — **STRONG for exactly one service**
- **Role:** an always-on **audio worker** that replaces the dormant `JobProcessor`: consume
  `audio_jobs`, orchestrate `ffmpeg`, write waveform/BPM/key/mood back to Supabase Storage.
- **Why Go:** native concurrency (worker pool over jobs), a single static binary, low memory —
  ideal on a constrained shared box. ffmpeg orchestration + IO fan-out is Go's sweet spot.
- **Future second role (Phase 18):** a **WebSocket/HLS streaming gateway** for listening parties.
- **Do NOT** use Go elsewhere — there is no CPU-bound graph/DSP work in the codebase today.

### 2.3 Ruby — **DEFENSIBLE for one role (weakest of the three; stated honestly)**
- **Role:** **Ruby + Sidekiq** as the always-on **scheduler + job queue** that replaces the
  Hobby-limited Vercel crons — enqueues strategic-agents, notification-prioritizer, nft-sync,
  push-sender, embed-refresh on real schedules and dispatches to the workers; also runs the two
  unimplemented stubs (cleanup, analytics/daily).
- **Why it's defensible:** Sidekiq is a best-in-class, battle-tested background-job system with
  excellent retry/observability ergonomics — a genuine expertise match for "reliable scheduling."
- **Honest caveat:** Node or Go could do this too. Ruby earns its place on **maturity/ops
  ergonomics, not necessity.** See §8 for the explicit "drop Ruby" alternative.

---

## 3. Lazy → Active remediation (the real list)
1. **Activate the audio pipeline** — Go worker consumes `audio_jobs` continuously. *Fixes §1.1.*
2. **Move scheduling off Hobby crons** — Sidekiq fires every job on a real schedule; keep the
   thin Vercel `/api/cron/*` routes as callable HTTP entry points, or have the tier hit Supabase
   directly with the service-role key. *Fixes §1.2.*
3. **Warm the Lua runtime** — long-lived container instead of per-request Python cold start. *Fixes §1.3.*
4. **Implement the two stubs** as scheduled jobs in the tier. *Fixes §1.4.*
5. **Out of scope (intentionally):** eager-loading React routes. Instead add **prefetch-on-hover**
   for primary nav links — the correct "non-lazy" UX without bundle bloat.

---

## 4. Proposed architecture

```
        ┌───────────────────────────┐         ┌──────────────────────────────┐
        │  Vercel (Next.js app)     │         │  Supabase                    │
        │  • UI + thin API routes   │  ⇄ REST │  • Postgres (RLS)            │
        │  • Auth, Realtime client  │  ⇄ WSS  │  • Storage  • Realtime       │
        └─────────────┬─────────────┘         └───────────────┬──────────────┘
                      │   (service-role over network / tunnel) │
                      ▼                                         ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │  Self-hosted ACTIVE WORKER TIER  (Podman, local box)              │
        │                                                                   │
        │   Sidekiq scheduler+queue (Ruby) ──dispatch──┐                    │
        │                                              ▼                    │
        │   Audio worker (Go + ffmpeg)   Warm Lua runtime   Redis           │
        │                                                                   │
        │   … alongside the existing BSL FastAPI engine …                   │
        └───────────────────────────────────────────────────────────────────┘
```
Supabase remains the single source of truth; the tier authenticates with the service-role key.

---

## 5. Phased roadmap
- **P0 — Podman base** — ✅ **DONE.** `worker/compose.yaml` (Podman/Docker compatible) with Redis (healthcheck) + the worker + the scheduler; systemd Quadlet at `worker/mixhive-audio-worker.container` for rootless auto-restart.
- **P1 — Go audio worker** — ✅ **DONE & verified.** `worker/audio/` (stdlib-only Go). Consumes `audio_jobs`, race-safe claim, decodes via ffmpeg, writes real 200-point `waveform_data` + `duration_seconds` to `mixes`. Builds as a Podman image; `--selftest` proves the pipeline (decoded a 5s file → 200 peaks). *Remaining:* point a live upload at it once the box has Supabase creds.
- **P2 — Scheduler (Ruby)** — ✅ **DONE** (pure-stdlib Ruby, no Sidekiq/gems needed for this scale). `worker/scheduler/schedule.rb` fires the Hobby-blocked crons (nft-sync, push-sender, notification-prioritizer) + the 2 stubs on real intervals via `CRON_SECRET`. Containerized + verified. *Upgrade path:* swap to Sidekiq if retry/observability needs grow.
- **P3 — Warm Lua runtime** container; point `/api/lua-agent/run` at it; drop the Python cold start. *(next session)*
- **P4 (future) — Go streaming gateway** for Phase 18 listening parties.

---

## 6. Risks & tradeoffs (named, not buried)
- **Polyglot burden:** adds Ruby + Go to an already-multi-language stack (TS / Python / Lua / SQL / shell). **Mitigation:** bound each to ONE service with a crisp contract — Supabase tables/queues are the only seam.
- **Two deploy targets:** Vercel + self-hosted box → needs monitoring, restart-on-crash (Quadlets), and an inbound path (Cloudflare Tunnel / Tailscale) if Vercel must reach the tier.
- **Single-box SPOF:** acceptable at current scale; document it and keep jobs idempotent so a restart re-drains the queue.
- **If self-hosting is ever abandoned:** the entire justification collapses — then prefer **Vercel Pro crons + a managed queue** and **drop Ruby/Go/Podman** rather than maintain a tier with no host.

---

## 7. Open decisions (resolve at the start of the new conversation)
1. **Host:** the local GTX 1080 box (alongside BSL) — assumed — vs a small VPS vs upgrading to Vercel Pro.
2. **Inbound path:** Cloudflare Tunnel vs Tailscale vs poll-only (no inbound).
3. **Ruby in or out:** keep Sidekiq/Ruby as scheduler, **or** fold scheduling into the Go worker and drop Ruby entirely (leaner, one fewer runtime). Honest recommendation: **start without Ruby** (Go worker self-schedules via a ticker), add Sidekiq only if scheduling complexity grows.

---

## 8. Kickoff prompt for the new conversation

> Copy-paste this to start the implementation session:

```
We're adding a self-hosted "Active Worker Tier" to MixHive to fix dormant execution that
Vercel serverless can't host. Read docs/INFRA_INTEGRATION_REPORT.md first.

Context: MixHive is Next.js 16 + Supabase on Vercel. The audio JobProcessor
(src/lib/job-processor.ts + src/lib/audio-processing.ts) is defined but never runs, so
uploaded mixes never get waveforms/BPM/key. vercel.json crons mostly don't fire on Hobby.

Goal P0→P1:
1. Stand up a Podman stack on the local box (reuse the existing Dockerfile/docker-compose.yml,
   OCI-compatible) with Redis + healthchecks + systemd Quadlets.
2. Build a Go audio worker that consumes the `audio_jobs` table, orchestrates ffmpeg, and writes
   waveform/BPM/key/mood back to Supabase Storage with the service-role key. Make jobs idempotent.
Acceptance: upload a mix on the live app → within a minute it has a waveform + analyzed metadata.

Decisions to confirm with me first: host (local box vs VPS), inbound path (Cloudflare Tunnel vs
poll-only), and whether to include Ruby/Sidekiq for scheduling or fold scheduling into the Go
worker (I lean: start without Ruby). Do NOT eager-load React routes — add prefetch-on-hover instead.

Key files: src/lib/job-processor.ts, src/lib/audio-processing.ts, src/app/api/audio/process/route.ts,
vercel.json (crons), api/lua-agent/run.py, src/server/lua-agents/.
```

---

*Bottom line: don't bolt three languages onto Vercel for its own sake. Build one bounded
self-hosted worker tier that makes already-written-but-dormant work actually run — Podman to
host it, Go for the audio worker, and Ruby/Sidekiq only if scheduling earns it.*
