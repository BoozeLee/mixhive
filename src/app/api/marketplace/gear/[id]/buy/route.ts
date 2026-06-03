// Create a Stripe Checkout session for a gear listing.
// The session captures payment into escrow (payment_intent_data.capture_method = manual).
// On success webhook: moves transaction to paid_escrow, notifies seller.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function makeClient(jwt: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

function feeRate(price: number): number {
  if (price >= 2000) return 0.025;
  if (price >= 500)  return 0.030;
  if (price >= 100)  return 0.040;
  return 0.050;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const sb = makeClient(authHeader.slice(7));

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    // Load listing
    const { data: listing, error: listingErr } = await sb
      .from('equipment_listings')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (listingErr || !listing) {
      return NextResponse.json({ error: 'Listing not found or not active' }, { status: 404 });
    }
    if (listing.seller_profile_id === user.id) {
      return NextResponse.json({ error: 'Cannot buy your own listing' }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-05-28.basil' });

    const priceInCents = Math.round(listing.price * 100);
    const fee = feeRate(listing.price);
    const applicationFeeAmount = Math.round(priceInCents * fee);

    const origin = req.headers.get('origin') || 'https://mixhive.vercel.app';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (listing.currency ?? 'EUR').toLowerCase(),
            product_data: {
              name: listing.title,
              description: listing.description?.slice(0, 255) || undefined,
              images: listing.photos?.slice(0, 1) ?? [],
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      // Capture manually so funds go into escrow until buyer confirms receipt
      payment_intent_data: {
        capture_method: 'manual',
        application_fee_amount: applicationFeeAmount,
      },
      success_url: `${origin}/marketplace/gear/${id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/marketplace/gear/${id}?payment=cancelled`,
      metadata: {
        listing_id: id,
        buyer_profile_id: user.id,
        seller_profile_id: listing.seller_profile_id,
        agreed_price: String(listing.price),
        currency: listing.currency ?? 'EUR',
        platform_fee_pct: String(fee * 100),
      },
    });

    // Pre-create the transaction record in pending state
    await sb.from('equipment_transactions').insert({
      listing_id: id,
      buyer_profile_id: user.id,
      seller_profile_id: listing.seller_profile_id,
      agreed_price: listing.price,
      currency: listing.currency ?? 'EUR',
      payment_provider: 'stripe',
      payment_reference: session.id,
      transaction_state: 'pending_payment',
      platform_fee_pct: fee * 100,
    });

    // Reserve the listing
    await sb
      .from('equipment_listings')
      .update({ status: 'reserved' })
      .eq('id', id);

    return NextResponse.json({ checkout_url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
