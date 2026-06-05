// Buyer confirms receipt of gear, releasing escrow to the seller: captures the
// held PaymentIntent, transfers the net via Connect, records the ledger row, and
// marks the transaction released / listing sold.
import { NextRequest, NextResponse } from 'next/server';
import { getStripe, makeUserClient, makeServiceClient, releaseGearEscrow } from '@/lib/stripe-connect';
import { handleApiError, forbidden, notFound } from '@/lib/api-errors';

export const runtime = 'nodejs';

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

    const svc = makeServiceClient();
    const { data: txn } = await svc
      .from('equipment_transactions')
      .select(
        'id, listing_id, payment_intent_id, agreed_price, platform_fee_pct, currency, seller_profile_id, buyer_profile_id, transaction_state'
      )
      .eq('listing_id', id)
      .in('transaction_state', ['paid_escrow', 'shipped', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!txn) return notFound('No releasable transaction for this listing');
    if (txn.buyer_profile_id !== user.id) return forbidden('Only the buyer can confirm receipt');

    const result = await releaseGearEscrow(getStripe(), svc, txn);
    if (result.held) {
      return NextResponse.json(
        { error: 'Seller has not finished setting up payouts. Payment stays in escrow.' },
        { status: 409 }
      );
    }

    try {
      await svc.from('notifications').insert([
        {
          user_id: txn.seller_profile_id,
          type: 'gear_payout',
          body: `Buyer confirmed receipt — your payout has been released to your Stripe account.`,
          metadata: { listing_id: id, transaction_id: txn.id },
          read: false,
        },
        {
          user_id: txn.buyer_profile_id,
          type: 'gear_confirmed',
          body: `You confirmed receipt. Thanks for using the MixHive marketplace.`,
          metadata: { listing_id: id, transaction_id: txn.id },
          read: false,
        },
      ]);
    } catch {
      // ignore notification failure
    }

    return NextResponse.json({ ok: true, transaction_state: 'released' });
  } catch (err) {
    return handleApiError(err, 'gear/confirm');
  }
}
