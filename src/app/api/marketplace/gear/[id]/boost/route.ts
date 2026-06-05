// Paid gear boost: the listing owner pays a fixed fee to surface their listing for
// N days. 100% platform revenue (no Connect transfer). The webhook sets
// equipment_listings.boosted_until on checkout.session.completed.
import { NextRequest, NextResponse } from 'next/server';
import { getStripe, makeUserClient } from '@/lib/stripe-connect';
import { handleApiError, forbidden, notFound, badRequest } from '@/lib/api-errors';

export const runtime = 'nodejs';

const BOOST_PRICE_EUR = 5; // per window
const BOOST_DAYS = 7;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const sb = makeUserClient(authHeader.slice(7));
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { data: listing } = await sb
      .from('equipment_listings')
      .select('id, title, seller_profile_id, status')
      .eq('id', id)
      .single();
    if (!listing) return notFound('Listing not found');
    if (listing.seller_profile_id !== user.id) return forbidden('Only the seller can boost this listing');
    if (listing.status !== 'active') return badRequest('Only active listings can be boosted');

    const origin = req.headers.get('origin') || 'https://mixhive.vercel.app';
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: `Boost: ${listing.title}`, description: `Featured for ${BOOST_DAYS} days` },
            unit_amount: BOOST_PRICE_EUR * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/marketplace/gear/${id}?boost=success`,
      cancel_url: `${origin}/marketplace/gear/${id}?boost=cancelled`,
      metadata: { boost: '1', listing_id: id, days: String(BOOST_DAYS) },
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (err) {
    return handleApiError(err, 'gear/boost');
  }
}
