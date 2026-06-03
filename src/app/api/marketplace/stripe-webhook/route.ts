// Stripe webhook handler for gear marketplace escrow.
// Handles: checkout.session.completed (→ paid_escrow)
// Future: payment_intent.captured (→ released), dispute events
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const runtime = 'nodejs';

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  // Use service role for webhook processing (server-side only, never exposed to browser)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_TOKEN!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-05-27.dahlia' });
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { listing_id, buyer_profile_id, seller_profile_id, agent_package_id, creator_profile_id } = session.metadata ?? {};

    // --- Gear marketplace escrow ---
    if (listing_id) {
      await sb
        .from('equipment_transactions')
        .update({
          transaction_state: 'paid_escrow',
          payment_reference: session.id,
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
        } catch {}
      }
    }

    // --- Agent marketplace: immediate fulfillment ---
    if (agent_package_id && buyer_profile_id) {
      const { data: agentId, error: installErr } = await sb.rpc('install_agent_package', {
        p_package_id: agent_package_id,
        p_config: {},
        p_buyer_id: buyer_profile_id,
      });

      await sb
        .from('lua_agent_package_purchases')
        .update({
          purchase_state: installErr ? 'failed' : 'completed',
          agent_id: installErr ? null : agentId,
          resolved_at: new Date().toISOString(),
        })
        .eq('payment_reference', session.id)
        .eq('purchase_state', 'pending_payment');

      if (!installErr) {
        try {
          await sb.from('notifications').insert({
            user_id: buyer_profile_id,
            type: 'agent_purchased',
            body: `Your agent purchase is complete — find it in your Agents dashboard.`,
            metadata: { agent_package_id, agent_id: agentId },
            read: false,
          });
        } catch {}

        if (creator_profile_id) {
          try {
            await sb.from('notifications').insert({
              user_id: creator_profile_id,
              type: 'agent_sale',
              body: `Your agent was purchased. Earnings will be paid out via your connected Stripe account.`,
              metadata: { agent_package_id },
              read: false,
            });
          } catch {}
        }
      }
    }
  }

  if (event.type === 'payment_intent.amount_capturable_updated') {
    // Payment captured → released to seller
    const pi = event.data.object as Stripe.PaymentIntent;
    const listingId = pi.metadata?.listing_id;
    if (listingId) {
      await sb
        .from('equipment_transactions')
        .update({ transaction_state: 'released', resolved_at: new Date().toISOString() })
        .eq('payment_reference', pi.id)
        .eq('transaction_state', 'delivered');

      await sb
        .from('equipment_listings')
        .update({ status: 'sold' })
        .eq('id', listingId);
    }
  }

  return NextResponse.json({ received: true });
}
