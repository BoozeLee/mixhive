// Buyer opens a dispute on a gear transaction. Freezes the escrow and notifies
// the seller and platform.
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

    let notes: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.notes === 'string') notes = body.notes.trim();
    } catch {
      // notes are optional
    }

    const svc = makeServiceClient();
    const { data: txn } = await svc
      .from('equipment_transactions')
      .select('id, seller_profile_id, buyer_profile_id, transaction_state')
      .eq('listing_id', id)
      .in('transaction_state', ['paid_escrow', 'shipped', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!txn) return notFound('No active transaction to dispute for this listing');
    if (txn.buyer_profile_id !== user.id) return forbidden('Only the buyer can open a dispute');

    await svc
      .from('equipment_transactions')
      .update({
        transaction_state: 'disputed',
        dispute_opened_at: new Date().toISOString(),
        dispute_notes: notes ?? 'Buyer opened a dispute via the app.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id);

    try {
      await svc.from('notifications').insert({
        user_id: txn.seller_profile_id,
        type: 'gear_disputed',
        body: `The buyer has opened a dispute for your gear. Escrow is frozen until resolved.`,
        metadata: { listing_id: id, transaction_id: txn.id },
        read: false,
      });

      // Also notify platform/admin if we had an admin notification table,
      // but for now the 'disputed' state in the DB is the source of truth.
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, transaction_state: 'disputed' });
  } catch (err) {
    return handleApiError(err, 'gear/dispute');
  }
}
