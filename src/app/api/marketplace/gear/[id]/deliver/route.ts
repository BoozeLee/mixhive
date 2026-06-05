// Buyer or seller marks a shipped gear transaction as delivered. Moves
// shipped → delivered and starts the auto-release hold window (delivered_at).
import { NextRequest, NextResponse } from 'next/server';
import { makeUserClient, makeServiceClient } from '@/lib/stripe-connect';
import { handleApiError, forbidden, notFound } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      .select('id, seller_profile_id, buyer_profile_id, transaction_state')
      .eq('listing_id', id)
      .eq('transaction_state', 'shipped')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!txn) return notFound('No shipped transaction to mark delivered for this listing');
    if (txn.buyer_profile_id !== user.id && txn.seller_profile_id !== user.id) {
      return forbidden('Only the buyer or seller can mark this delivered');
    }

    await svc
      .from('equipment_transactions')
      .update({
        transaction_state: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id)
      .eq('transaction_state', 'shipped');

    try {
      await svc.from('notifications').insert({
        user_id: txn.buyer_profile_id,
        type: 'gear_delivered',
        body: `Your gear is marked delivered. Confirm receipt to release payment, or funds auto-release in 3 days.`,
        metadata: { listing_id: id, transaction_id: txn.id },
        read: false,
      });
    } catch {
      // ignore notification failure
    }

    return NextResponse.json({ ok: true, transaction_state: 'delivered' });
  } catch (err) {
    return handleApiError(err, 'gear/deliver');
  }
}
