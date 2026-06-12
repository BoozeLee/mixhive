// Seller marks a gear escrow transaction as shipped, with an optional tracking
// number. Moves paid_escrow → shipped and notifies the buyer.
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

    let trackingNumber: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.tracking_number === 'string') trackingNumber = body.tracking_number.trim();
    } catch {
      // no body is fine
    }

    const svc = makeServiceClient();
    const { data: txn } = await svc
      .from('equipment_transactions')
      .select('id, seller_profile_id, buyer_profile_id, transaction_state')
      .eq('listing_id', id)
      .eq('transaction_state', 'paid_escrow')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!txn) return notFound('No escrowed transaction to ship for this listing');
    if (txn.seller_profile_id !== user.id)
      return forbidden('Only the seller can mark this shipped');

    await svc
      .from('equipment_transactions')
      .update({
        transaction_state: 'shipped',
        shipped_at: new Date().toISOString(),
        ...(trackingNumber ? { tracking_number: trackingNumber } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id)
      .eq('transaction_state', 'paid_escrow');

    try {
      await svc.from('notifications').insert({
        user_id: txn.buyer_profile_id,
        type: 'gear_shipped',
        body: trackingNumber
          ? `Your gear has shipped — tracking ${trackingNumber}. Mark it delivered when it arrives.`
          : `Your gear has shipped. Mark it delivered when it arrives.`,
        metadata: { listing_id: id, transaction_id: txn.id },
        read: false,
      });
    } catch {
      // notification failures must not block the state change
    }

    return NextResponse.json({ ok: true, transaction_state: 'shipped' });
  } catch (err) {
    return handleApiError(err, 'gear/ship');
  }
}
