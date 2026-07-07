# Stripe Test Mode — Quick Start

## Prerequisites

1. Stripe account → **Test mode** toggle ON
2. Create 3 subscription products (monthly):

| Product | Price | Suggested Price ID env var |
|---------|-------|--------------------------|
| Supporter | €5 | `NEXT_PUBLIC_SUPPORTER_PRICE_ID` |
| Insider | €12 | `NEXT_PUBLIC_INSIDER_PRICE_ID` |
| Patron | €25 | `NEXT_PUBLIC_PATRON_PRICE_ID` |

## Env Vars to Set

```bash
# Stripe API
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx    # from Stripe Dashboard → Webhooks

# Price IDs (one per tier)
NEXT_PUBLIC_SUPPORTER_PRICE_ID=price_xxx
NEXT_PUBLIC_INSIDER_PRICE_ID=price_xxx
NEXT_PUBLIC_PATRON_PRICE_ID=price_xxx

# Webhook tier mapping (same value as above, key must start with STRIPE_PRICE_)
STRIPE_PRICE_SUPPORTER=price_xxx   # maps to tier 'supporter'
STRIPE_PRICE_INSIDER=price_xxx     # maps to tier 'insider'
STRIPE_PRICE_PATRON=price_xxx      # maps to tier 'patron'
```

Set on Vercel: `vercel env add STRIPE_SECRET_KEY production` (repeat for each).

## Webhook Endpoint

Register in Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

```
https://mixhive.vercel.app/api/subscription/webhook
```

**Events to listen for:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Also register for marketplace:
```
https://mixhive.vercel.app/api/marketplace/stripe-webhook
```
Events: `checkout.session.completed`, `account.updated`, `charge.refunded`, `charge.dispute.*`

## Local Development

Use Stripe CLI to forward webhooks locally:

```bash
stripe listen --forward-to http://localhost:3000/api/subscription/webhook
stripe listen --forward-to http://localhost:3000/api/marketplace/stripe-webhook
```

## Verify the Flow

1. Open `/pricing` → click "Subscribe" on any tier
2. Redirected to Stripe Checkout → use card `4242 4242 4242 4242` (test)
3. After payment → redirected to `/settings?subscription=success`
4. Check `GET /api/subscription/status` returns `{ tier: "insider", status: "active" }`
5. Visit Pricing page again — the "Subscribe" button should show "Manage" instead

## Migration

Ensure migration 102 (`subscription_tiers`) has been applied:

```bash
supabase db push
```

Then regenerate types:

```bash
npm run db:types
```
