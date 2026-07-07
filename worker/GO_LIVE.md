# Audio Worker — Go-Live Checklist

Phase α: bring the always-on audio worker online so uploaded mixes get
**waveform + duration + BPM + key + mood** in production (Vercel serverless can't
run this). The worker code is verified deploy-ready (builds, `go test` green, and
`--selftest` produces real analysis incl. musical key).

**Status: ✅ COMPLETE** — audio worker + scheduler both running since Jul 5, 2026.
See [verification below](#7-verify-end-to-end) for current operational status.

Prereqs: Podman, rootless systemd, and outbound HTTPS to Supabase.

## 1. Credentials
```bash
mkdir -p ~/.config/mixhive
cp worker/audio/.env.example ~/.config/mixhive/worker.env
$EDITOR ~/.config/mixhive/worker.env   # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

## 2. Smoke-test the analyzer (no network)
```bash
go run ./worker/audio --selftest /path/to/any-track.mp3
# expect: "selftest OK: duration=…"  and  "bpm=… mood=… key=…"
```

## 3. Run the worker (+ Redis) via Podman compose
```bash
set -a; source ~/.config/mixhive/worker.env; set +a
podman compose -f worker/compose.yaml up -d --build
podman logs -f mixhive-audio-worker     # confirm it polls audio_jobs
```

## 4. Auto-start on boot (rootless systemd Quadlets)
```bash
cp worker/mixhive-audio-worker.container ~/.config/containers/systemd/
cp worker/mixhive-scheduler.container    ~/.config/containers/systemd/
loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user start mixhive-audio-worker mixhive-scheduler
```
The **scheduler** fires the crons Vercel Hobby can't (nft-sync, push-sender,
notification-prioritizer, embed-refresh, payouts-auto-release, etc.).

## 5. Inbound path for health/webhooks (Cloudflare Tunnel)
```bash
# edit worker/cloudflared-config.yml with your tunnel + hostname, then:
cloudflared tunnel run mixhive
```
Verify Vercel/you can reach `https://<host>/api/health/worker` → `200` green.

## 6. Backfill the existing catalog
```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  node scripts/enqueue_waveform_backfill.mjs            # dry-run: counts + sample
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  node scripts/enqueue_waveform_backfill.mjs --commit   # enqueue bpm_key_mood jobs
```
Watch the queue drain in the worker logs.

## 7. Verify end-to-end
- Upload a fresh track in the app → within seconds the `mixes` row gets
  `waveform_data` + `duration_seconds`, and `audio_features` gets `bpm` / `mood`
  / `musical_key` (`source = go-worker`, `model = ffmpeg-autocorr-chroma-v2`).
- `audio_jobs` rows move `pending → processing → complete`.
- `/api/health` at mixhive.vercel.app reports `audio_queue` healthy.

### Current Operational Status (Jul 7, 2026)
- **mixhive-audio-worker**: Up 47h (Quadlet, auto-restart)
- **mixhive-scheduler**: Up 47h, firing push-sender every 5min, nft-sync +
  notification-prioritizer hourly — all returning 200
- **Sample output**: Mix `6866f9e4..` → waveform ✓, duration 34s, BPM 64.3,
  key C maj, mood transition (source: `go-worker`)
- **Production health**: mixhive.vercel.app/api/health → all green
- **Cloudflare Tunnel**: See `cloudflared-config.yml` — blocked on port 7844
  outbound (requires router config)

## Rollback
`systemctl --user stop mixhive-audio-worker mixhive-scheduler` and
`podman compose -f worker/compose.yaml down`. Jobs stay queued (`pending`) and
resume when the worker restarts — no data loss.
