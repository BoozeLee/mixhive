import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { getStripe, makeServiceClient, releaseGearEscrow, type GearTxn } from '@/lib/stripe-connect';

// Auto-release cron. Releases gear escrow that the buyer never confirmed, after a
// 3-day hold past delivery, and sweeps held creator/seller earnings once they
// finish onboarding. Fired by the self-hosted Ruby scheduler and Vercel cron,
// both sending Authorization: Bearer <CRON_SECRET>.
//
// PREREQUISITE: CRON_SECRET must be set in Vercel before this ships — otherwise
// the route is open. The gate below only enforces when the secret is present.

export const runtime = 'nodejs';
export const maxDuration = 60;

const HOLD_DAYS = 3;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  try {
    const sb = makeServiceClient();
    const stripe = getStripe();
    const result = { released: 0, held: 0, swept: 0 };

    // 1. Auto-release delivered transactions past the hold window (skip disputed).
    const cutoff = new Date(Date.now() - HOLD_DAYS * 86_400_000).toISOString();
    const { data: due } = await sb
      .from('equipment_transactions')
      .select(
        'id, listing_id, payment_intent_id, agreed_price, platform_fee_pct, currency, seller_profile_id, buyer_profile_id'
      )
      .eq('transaction_state', 'delivered')
      .lt('delivered_at', cutoff)
      .limit(100);

    for (const txn of (due ?? []) as GearTxn[]) {
      try {
        const r = await releaseGearEscrow(stripe, sb, txn);
        if (r.released) {
          result.released += 1;
          try {
            await sb.from('notifications').insert({
              user_id: txn.seller_profile_id,
              type: 'gear_payout',
              body: `Auto-released after ${HOLD_DAYS} days — your payout is on its way to your Stripe account.`,
              metadata: { listing_id: txn.listing_id, transaction_id: txn.id },
              read: false,
            });
          } catch {
            // ignore notification failure
          }
        } else if (r.held) {
          result.held += 1;
        }
      } catch (err) {
        console.error('[payouts-auto-release] release failed', txn.id, err);
      }
    }

    // 2. Sweep held earnings whose recipient has since enabled payouts.
    const { data: heldRows } = await sb
      .from('platform_fee_ledger')
      .select('id, source_type, source_id, seller_profile_id, net_to_seller, currency')
      .eq('status', 'held')
      .limit(100);

    for (const row of heldRows ?? []) {
      try {
        const { data: seller } = await sb
          .from('profiles')
          .select('stripe_account_id, payouts_enabled')
          .eq('id', row.seller_profile_id)
          .single();
        if (!seller?.payouts_enabled || !seller.stripe_account_id) continue;

        const transfer = await stripe.transfers.create(
          {
            amount: Math.round(Number(row.net_to_seller) * 100),
            currency: String(row.currency).toLowerCase(),
            destination: seller.stripe_account_id as string,
            transfer_group: `${row.source_type}-${row.source_id}`,
            metadata: { source_type: row.source_type, source_id: row.source_id, swept: '1' },
          },
          { idempotencyKey: `${row.source_type}-transfer-${row.source_id}` }
        );
        await sb
          .from('platform_fee_ledger')
          .update({ status: 'transferred', stripe_transfer_id: transfer.id })
          .eq('id', row.id)
          .eq('status', 'held');
        result.swept += 1;

        try {
          await sb.from('notifications').insert({
            user_id: row.seller_profile_id,
            type: 'earnings_paid',
            body: `Your held earnings have been paid out now that your payout account is active.`,
            metadata: { source_type: row.source_type, source_id: row.source_id },
            read: false,
          });
        } catch {
          // ignore notification failure
        }
      } catch (err) {
        console.error('[payouts-auto-release] sweep failed', row.id, err);
      }
    }

    return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
