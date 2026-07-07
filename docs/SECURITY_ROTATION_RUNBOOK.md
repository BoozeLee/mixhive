# Security Rotation Runbook

> **Owner:** repo owner (dashboard/live-key access required). Claude/Codex cannot perform these —
> they touch live keys and provider dashboards. This file contains **steps only, no secret values.**
> Basecamp follow-ups: `#10009399644`, `#10010273239`.

## Why this exists

During Phase-16 close-out we found:

| Item | Where | Severity | Repo hardening already done |
|---|---|---|---|
| Supabase **PAT** `sbp_31bb…` | local `~/.config/mixhive/worker.env` (+ a stale backup) | Leaked; **unused** by the worker | Line removed from `worker.env`; backup shredded |
| Supabase **service-role key** (project `ljdolmqytncxhgojqguh`) | local `worker.env` | Live secret; **used** by the worker | Left in place (worker needs it); rotate as defense-in-depth |
| `CRON_SECRET` | local `worker.env` | Live secret; used by scheduler + push cron | Left in place; rotate as defense-in-depth |
| `.env.local` **tracked in git** | repo | Low — held only the **anon** key (public) + a short-lived `VERCEL_OIDC_TOKEN` | `git rm --cached .env.local`; now `.gitignore`d |

No service-role or Stripe secret was ever committed to the repo. The tracked `.env.local` exposed
only the public anon key and an expiring OIDC token — no rotation strictly required, but review below.

## 1. Supabase PAT (revoke — do first)

1. Supabase dashboard → **Account → Access Tokens**.
2. Revoke the token beginning `sbp_31bb…`.
3. The worker does **not** use a PAT, so nothing consumes it. If you later need a PAT (CLI/CI),
   generate a fresh one and store it only in a secrets manager — never in a repo or committed env.

## 2. Supabase service-role key (rotate — recommended)

1. Dashboard → **Project `ljdolmqytncxhgojqguh` → Settings → API → service_role**. Roll/regenerate.
2. Update every consumer with the new value:
   - Local worker: `~/.config/mixhive/worker.env` → `SUPABASE_SERVICE_ROLE_KEY=…`, then restart the
     Quadlets: `systemctl --user restart mixhive-audio-worker mixhive-scheduler`.
   - Vercel: `vercel env rm SUPABASE_SERVICE_ROLE_KEY production` then `vercel env add …` (or the
     dashboard). Repeat for preview if set.
3. Redeploy production so functions pick up the new value.

## 3. Stripe keys (rotate)

1. Stripe dashboard → **Developers → API keys**: roll the **secret key** (and publishable if desired).
2. **Developers → Webhooks**: roll the **signing secret** for the MixHive endpoint.
3. Update Vercel env (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, publishable if used) via
   `vercel env` or dashboard → redeploy.
4. **Do not** exercise these with live keys locally — payments stay deferred to the P14 pre-launch
   gate and are verified in **Stripe TEST mode** only.

## 4. CRON_SECRET (rotate — recommended)

1. Generate a new random value (e.g. `openssl rand -hex 32`).
2. Update `~/.config/mixhive/worker.env` (`CRON_SECRET=…`) + restart the scheduler Quadlet.
3. Update Vercel env `CRON_SECRET` → redeploy so the cron endpoints (`/api/cron/*`, `/api/push/send`)
   accept the new bearer.

## 5. `.env.local` (already handled in-repo)

- Untracked via `git rm --cached .env.local`; `.gitignore` now covers `.env.*` (with `!.env.example`).
- The exposed anon key is public by design; the OIDC token is short-lived. No rotation needed.
- If you want the value scrubbed from git **history** (optional, low value here), use
  `git filter-repo --path .env.local --invert-paths` on a coordinated force-push. Not required.

## 6. Verify after rotation

```bash
# production
curl -s https://mixhive.vercel.app/api/health | jq .status      # → "healthy"
# local worker still processing
systemctl --user status mixhive-audio-worker mixhive-scheduler
# repo hygiene
git ls-files | grep -c '\.env.local'                            # → 0
```

Then close Basecamp `#10009399644` / `#10010273239`.
