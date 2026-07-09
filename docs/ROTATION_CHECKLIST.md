# Security Rotation Checklist

**Owner must execute.** These steps touch live dashboards and secrets.
Estimated time: 20 minutes.

---

## Step 1 — Revoke Supabase PAT (60s)

```bash
# 1. Open https://supabase.com/dashboard/account/tokens
# 2. Revoke token beginning "sbp_31bb…"
```

**Impact:** Zero — no production code uses the PAT. The CI schema-drift workflow uses its own GitHub secret.

---

## Step 2 — Create OpenAI API key (2 min)

```bash
# Option A — Platform-paid (admin path, ~$0.04/image)
# 1. Open https://platform.openai.com/api-keys
# 2. Create a new secret key "mixhive-production"
# 3. Set in Vercel:
vercel env add OPENAI_API_KEY production
# 4. For local dev, add to .env.development:
#    OPENAI_API_KEY=sk-…
```

```bash
# Option B — Bring-your-own (free, user pays)
# No action needed. Any user can go to:
#   Settings → AI & Creativity
# and paste their own OpenAI key. Works immediately.
```

---

## Step 3 — Rotate Stripe live keys (10 min)

```bash
# 1. Open https://dashboard.stripe.com/apikeys
#    → Roll secret key (sk_live_…)
#    → Roll publishable key (pk_live_…)
# 2. Open https://dashboard.stripe.com/webhooks
#    → Find the MixHive endpoint → roll signing secret (whsec_…)

# 3. Set new values in Vercel:
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
```

**Payments remain disabled** (503) until a future P14 gate removes the key guards.

---

## Step 4 — Redeploy (2 min)

```bash
vercel deploy --prod --yes
```

---

## Step 5 — Verify

```bash
curl -s https://mixhive.vercel.app/api/health | jq .status
# → "healthy"

# Worker health (on worker box):
systemctl --user status mixhive-audio-worker mixhive-scheduler

# Art Studio works (admin):
# Go to /studio/avatar, pick fields, click Generate → should render DALL·E image

# Close Basecamp #10009399644 and #10010273239
```

---

## Summary of what was done vs. what you need to do

| Item | Claude handled | Owner needs to do |
|------|---------------|-------------------|
| Stale `.env*.bak*` files | ✅ Deleted | — |
| `.env.example` | ✅ Updated with all 40+ vars | — |
| Supabase PAT leak | — | Revoke token in Supabase dashboard (1 click) |
| OpenAI key | — | Create key in OpenAI dashboard + `vercel env add` (or use BYO) |
| Stripe keys | — | Roll keys in Stripe dashboard + `vercel env add` |
| Redeploy | — | `vercel deploy --prod --yes` |
