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

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-05-28.basil' });
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
    const { listing_id, buyer_profile_id, seller_profile_id } = session.metadata ?? {};

    if (!listing_id) return NextResponse.json({ ok: true });

    // Move transaction to paid_escrow
    await sb
      .from('equipment_transactions')
      .update({
        transaction_state: 'paid_escrow',
        payment_reference: session.id,
      })
      .eq('listing_id', listing_id)
      .eq('transaction_state', 'pending_payment');

    // Notify seller
    if (seller_profile_id) {
      await sb.from('notifications').insert({
        user_id: seller_profile_id,
        type: 'gear_sale',
        body: `Your gear listing has a buyer — payment secured in escrow. Ship the item and add a tracking number.`,
        metadata: { listing_id, buyer_profile_id },
        read: false,
      }).catch(() => {});
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
