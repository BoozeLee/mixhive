// Create a Stripe Checkout session for a paid agent package.
// Digital goods: immediate fulfillment, no escrow. 70/30 split (platform 30%).
// Webhook handles install after payment_intent.succeeded.
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

const PLATFORM_FEE_PCT = 30;

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

    const { data: pkg, error: pkgErr } = await sb
      .from('lua_agent_packages')
      .select('id, name, tagline, price, currency, creator_profile_id')
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (pkgErr || !pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }
    if (pkg.price <= 0) {
      return NextResponse.json({ error: 'This package is free — use the install endpoint' }, { status: 400 });
    }
    if (pkg.creator_profile_id === user.id) {
      return NextResponse.json({ error: 'Cannot purchase your own package' }, { status: 400 });
    }

    // Check for existing completed purchase
    const { data: existing } = await sb
      .from('lua_agent_package_purchases')
      .select('id')
      .eq('package_id', id)
      .eq('buyer_profile_id', user.id)
      .eq('purchase_state', 'completed')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already purchased' }, { status: 409 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2026-05-27.dahlia' });
    const priceInCents = Math.round(pkg.price * 100);
    const origin = req.headers.get('origin') || 'https://mixhive.vercel.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (pkg.currency ?? 'EUR').toLowerCase(),
            product_data: {
              name: pkg.name,
              description: pkg.tagline ?? undefined,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/marketplace/agents?payment=success&package_id=${id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/marketplace/agents?payment=cancelled`,
      metadata: {
        agent_package_id: id,
        buyer_profile_id: user.id,
        creator_profile_id: pkg.creator_profile_id ?? '',
        amount: String(pkg.price),
        currency: pkg.currency ?? 'EUR',
        platform_fee_pct: String(PLATFORM_FEE_PCT),
      },
    });

    // Pre-create purchase record in pending state
    await sb.from('lua_agent_package_purchases').insert({
      package_id: id,
      buyer_profile_id: user.id,
      creator_profile_id: pkg.creator_profile_id,
      amount_paid: pkg.price,
      currency: pkg.currency ?? 'EUR',
      platform_fee_pct: PLATFORM_FEE_PCT,
      payment_provider: 'stripe',
      payment_reference: session.id,
      purchase_state: 'pending_payment',
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
