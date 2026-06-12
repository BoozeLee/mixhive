# MixHive Active Worker Tier

Self-hosted, always-on services that run the work Vercel serverless **can't** host.
See [`../docs/INFRA_INTEGRATION_REPORT.md`](../docs/INFRA_INTEGRATION_REPORT.md) for the full rationale.

**P1 (shipped here):** the **audio worker** (Go + ffmpeg) — the always-on consumer of the
`public.audio_jobs` queue that replaces the dormant TS `JobProcessor`
(`src/lib/job-processor.ts`), which was defined but never ran on Vercel. Uploaded mixes now
get real **waveform peaks** + **duration** written back to the `mixes` row.

## What it does

1. Polls `audio_jobs` for `status = 'pending'` (oldest first), **atomically claims** one
   (`pending → processing`, race-safe via PostgREST conditional update).
2. Loads the mix, downloads `audio_url`, decodes with `ffmpeg` to mono 8 kHz PCM.
3. Computes a normalized **200-point waveform peak array** + duration.
4. Writes `waveform_data` + `duration_seconds` onto `mixes`, marks the job `complete`
   (or `failed`/re-`pending` with retry on error).

Stdlib-only Go → single static binary, no module downloads, low memory. Honors a job
timeout and drains in-flight jobs on `SIGINT`/`SIGTERM`.

## Run it (Podman)

```bash
# 1. Provide credentials
cp worker/audio/.env.example ~/.config/mixhive/worker.env
$EDITOR ~/.config/mixhive/worker.env   # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

# 2a. Compose (worker + Redis)
set -a; source ~/.config/mixhive/worker.env; set +a
podman compose -f worker/compose.yaml up -d --build

# 2b. …or single container
podman build -t localhost/mixhive-audio-worker ./worker/audio
podman run -d --restart unless-stopped --env-file ~/.config/mixhive/worker.env \
  --name mixhive-audio-worker localhost/mixhive-audio-worker
```

### Auto-start on boot (rootless systemd)

```bash
cp worker/mixhive-audio-worker.container ~/.config/containers/systemd/
loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user start mixhive-audio-worker
```

## Verify without Supabase

```bash
# decode a local file and print the analysis — no network needed
go run ./worker/audio --selftest /path/to/track.mp3
# or inside the image:
podman run --rm -v /path/track.mp3:/t.mp3:ro localhost/mixhive-audio-worker --selftest /t.mp3
```

## Env vars

| Var | Default | Notes |
|-----|---------|-------|
| `SUPABASE_URL` | — | required (or `NEXT_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | required; server-only secret |
| `AUDIO_BUCKET` | `mix-audio` | the real bucket (the old TS code used a wrong name) |
| `POLL_INTERVAL_MS` | `5000` | queue poll cadence |
| `MAX_CONCURRENT` | `3` | parallel jobs |
| `JOB_TIMEOUT_MS` | `300000` | per-job ceiling |
| `WAVEFORM_POINTS` | `200` | peak resolution |

### Creator talkback TURN relay

Mythic Ritual creator talkback is peer-to-peer WebRTC with Coturn fallback for creators
behind strict NAT. Production uses short-lived TURN REST credentials; the HMAC secret is
never compiled into the browser. See [`../docs/TURN_RELAY_RUNBOOK.md`](../docs/TURN_RELAY_RUNBOOK.md)
for the provider-neutral VPS, DNS, firewall, TLS, verification, and quarterly-rotation
procedure.

The compose profile remains available for local/infrastructure testing:

```bash
podman compose -f worker/compose.yaml --profile rituals up -d coturn
```

Set `TURN_SHARED_SECRET` and `TURN_EXTERNAL_IP` in the environment. Production Vercel
uses the same server-only secret with `TURN_CREDENTIALS_ENABLED=true`; never configure
`NEXT_PUBLIC_TURN_*`. Public audiences never receive credentials or connect to the
creator relay.

## Not yet here (next sessions)
- `bpm_key_mood` real analysis (aubio/essentia) — currently waveform+duration only.
- `tracklist` fingerprinting.
- Scheduler for the Hobby-blocked crons (Go ticker, or Ruby/Sidekiq — see report §7).
- Warm Lua runtime container.
