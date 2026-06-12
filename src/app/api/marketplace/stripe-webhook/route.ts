// Stripe webhook for the marketplace money loop.
//
// Handles:
//   checkout.session.completed          gear → paid_escrow (+ store PI id);
//                                        agent → install + 70/30 Connect payout;
//                                        boost → set boosted_until
//   account.updated                     sync Connect capability flags onto profile
//   charge.refunded                     gear txn → refunded, free listing
//   charge.dispute.created / .closed    freeze / resolve gear escrow
//
// Idempotency: ledger unique (source_type, source_id) + Stripe idempotency keys +
// state-guarded updates. Gear funds are released later via the confirm endpoint or
// the auto-release cron (separate charges & transfers) — NOT here.
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  getStripe,
  makeServiceClient,
  payoutToSeller,
  onboardingStateFromAccount,
} from '@/lib/stripe-connect';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${err}` }, { status: 400 });
  }

  const sb = makeServiceClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, sb, event.data.object as Stripe.Checkout.Session);
        break;
      case 'account.updated':
        await handleAccountUpdated(sb, event.data.object as Stripe.Account);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(sb, event.data.object as Stripe.Charge);
        break;
      case 'charge.dispute.created':
        await handleDisputeCreated(sb, event.data.object as Stripe.Dispute);
        break;
      case 'charge.dispute.closed':
        await handleDisputeClosed(sb, event.data.object as Stripe.Dispute);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook]', event.type, err);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

type Sb = ReturnType<typeof makeServiceClient>;

async function handleCheckoutCompleted(stripe: Stripe, sb: Sb, session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {};
  const { listing_id, buyer_profile_id, seller_profile_id, agent_package_id, creator_profile_id } =
    meta;

  // --- Paid gear boost: extend the listing's boosted_until window ---
  if (meta.boost === '1' && listing_id) {
    const days = Math.max(1, parseInt(meta.days ?? '7', 10) || 7);
    const { data: listing } = await sb
      .from('equipment_listings')
      .select('boosted_until')
      .eq('id', listing_id)
      .single();
    const base = listing?.boosted_until ? new Date(listing.boosted_until) : new Date();
    const from = base.getTime() > Date.now() ? base : new Date();
    const until = new Date(from.getTime() + days * 86_400_000).toISOString();
    await sb.from('equipment_listings').update({ boosted_until: until }).eq('id', listing_id);
    return;
  }

  // --- Gear marketplace escrow: hold funds, store PI id for later capture ---
  if (listing_id) {
    await sb
      .from('equipment_transactions')
      .update({
        transaction_state: 'paid_escrow',
        payment_reference: session.id,
        payment_intent_id: (session.payment_intent as string) ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('listing_id', listing_id)
      .eq('transaction_state', 'pending_payment');

    if (seller_profile_id) {
      try {
        await sb.from('notifications').insert({
          user_id: seller_profile_id,
          type: 'gear_sale',
          body: `Your gear listing has a buyer — payment secured in escrow. Ship the item and add a tracking number.`,
          metadata: { listing_id, buyer_profile_id },
          read: false,
        });
      } catch {
        // ignore notification failure
      }
    }
  }

  // --- Agent marketplace: immediate fulfillment + 70/30 Connect payout ---
  if (agent_package_id && buyer_profile_id) {
    const { data: agentId, error: installErr } = await sb.rpc('install_agent_package', {
      p_package_id: agent_package_id,
      p_config: {},
      p_buyer_id: buyer_profile_id,
    });

    const { data: purchase } = await sb
      .from('lua_agent_package_purchases')
      .update({
        purchase_state: installErr ? 'failed' : 'completed',
        agent_id: installErr ? null : agentId,
        resolved_at: new Date().toISOString(),
      })
      .eq('payment_reference', session.id)
      .eq('purchase_state', 'pending_payment')
      .select('id, amount_paid, currency, platform_fee_pct')
      .maybeSingle();

    if (installErr || !purchase) return;

    try {
      await sb.from('notifications').insert({
        user_id: buyer_profile_id,
        type: 'agent_purchased',
        body: `Your agent purchase is complete — find it in your Agents dashboard.`,
        metadata: { agent_package_id, agent_id: agentId },
        read: false,
      });
    } catch {
      // ignore
    }

    if (creator_profile_id) {
      const payout = await payoutToSeller(stripe, sb, {
        sourceType: 'agent',
        sourceId: purchase.id,
        sellerProfileId: creator_profile_id,
        grossCents: Math.round(Number(purchase.amount_paid) * 100),
        feePct: Number(purchase.platform_fee_pct ?? 30),
        currency: String(purchase.currency ?? 'EUR'),
      });
      try {
        await sb.from('notifications').insert({
          user_id: creator_profile_id,
          type: 'agent_sale',
          body:
            payout.status === 'transferred'
              ? `Your agent was purchased — your 70% payout is on its way to your Stripe account.`
              : `Your agent was purchased. Set up payouts in Earnings to release your held earnings.`,
          metadata: { agent_package_id, purchase_id: purchase.id, payout: payout.status },
          read: false,
        });
      } catch {
        // ignore
      }
    }
  }
}

async function handleAccountUpdated(sb: Sb, account: Stripe.Account) {
  await sb
    .from('profiles')
    .update({
      payouts_enabled: Boolean(account.payouts_enabled),
      charges_enabled: Boolean(account.charges_enabled),
      connect_onboarding_state: onboardingStateFromAccount(account),
    })
    .eq('stripe_account_id', account.id);
}

async function handleChargeRefunded(sb: Sb, charge: Stripe.Charge) {
  const pi =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;

  const { data: txn } = await sb
    .from('equipment_transactions')
    .select('id, listing_id, buyer_profile_id, seller_profile_id')
    .eq('payment_intent_id', pi)
    .maybeSingle();
  if (!txn) return;

  await sb
    .from('equipment_transactions')
    .update({
      transaction_state: 'refunded',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', txn.id)
    .neq('transaction_state', 'released');

  // Free the listing so it can sell again.
  await sb.from('equipment_listings').update({ status: 'active' }).eq('id', txn.listing_id);

  try {
    await sb.from('notifications').insert([
      {
        user_id: txn.buyer_profile_id,
        type: 'gear_refunded',
        body: `Your gear purchase was refunded.`,
        metadata: { transaction_id: txn.id },
        read: false,
      },
      {
        user_id: txn.seller_profile_id,
        type: 'gear_refunded',
        body: `A gear transaction was refunded and the listing is active again.`,
        metadata: { transaction_id: txn.id },
        read: false,
      },
    ]);
  } catch {
    // ignore
  }
}

async function handleDisputeCreated(sb: Sb, dispute: Stripe.Dispute) {
  const pi =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  if (!pi) return;

  const { data: txn } = await sb
    .from('equipment_transactions')
    .select('id, seller_profile_id')
    .eq('payment_intent_id', pi)
    .maybeSingle();
  if (!txn) return;

  await sb
    .from('equipment_transactions')
    .update({
      transaction_state: 'disputed',
      dispute_opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', txn.id)
    .neq('transaction_state', 'released');

  try {
    await sb.from('notifications').insert({
      user_id: txn.seller_profile_id,
      type: 'gear_disputed',
      body: `A payment was disputed — this transaction is frozen until the dispute resolves.`,
      metadata: { transaction_id: txn.id },
      read: false,
    });
  } catch {
    // ignore
  }
}

async function handleDisputeClosed(sb: Sb, dispute: Stripe.Dispute) {
  const pi =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  if (!pi) return;

  const { data: txn } = await sb
    .from('equipment_transactions')
    .select('id, listing_id')
    .eq('payment_intent_id', pi)
    .eq('transaction_state', 'disputed')
    .maybeSingle();
  if (!txn) return;

  if (dispute.status === 'won') {
    // Platform kept the funds — return the transaction to delivered so it can
    // release normally (buyer confirm or auto-release).
    await sb
      .from('equipment_transactions')
      .update({
        transaction_state: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id)
      .eq('transaction_state', 'disputed');
  } else if (dispute.status === 'lost') {
    await sb
      .from('equipment_transactions')
      .update({
        transaction_state: 'refunded',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id)
      .eq('transaction_state', 'disputed');
    await sb.from('equipment_listings').update({ status: 'active' }).eq('id', txn.listing_id);
  }
}
