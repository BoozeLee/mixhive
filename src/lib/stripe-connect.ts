// Shared Stripe Connect helpers for Phase 2 payouts (server-side only).
//
// Charge model: SEPARATE CHARGES & TRANSFERS. The platform is merchant of record,
// captures funds to the platform balance, holds during escrow, then transfers the
// net (gross − platform fee) to the seller/creator's Express connected account at
// release. The platform_fee_ledger has a unique (source_type, source_id) index so a
// webhook/cron retry can never double-transfer.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-05-27.dahlia';

/** Stripe client, or throws if the platform key is missing. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe not configured');
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

/** Service-role Supabase client for webhook/cron/payout writes (never browser). */
export function makeServiceClient(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_TOKEN || '';
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Anon Supabase client scoped to a user's JWT (RLS enforced). */
export function makeUserClient(jwt: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

/** Split a gross amount (in cents) into platform fee and net-to-seller (in cents). */
export function splitCents(grossCents: number, feePct: number) {
  const feeCents = Math.round(grossCents * (feePct / 100));
  return { feeCents, netCents: grossCents - feeCents };
}

export interface PayoutInput {
  sourceType: 'gear' | 'agent';
  sourceId: string;
  sellerProfileId: string;
  grossCents: number;
  feePct: number;
  currency: string;
}

export type PayoutResult = { status: 'transferred' | 'held'; transferId: string | null };

/**
 * Transfer net funds to a seller/creator's connected account and record the payout
 * in platform_fee_ledger. Idempotent: a transferred ledger row short-circuits, the
 * ledger unique index plus a Stripe idempotency key prevent duplicate transfers, and
 * a seller without payouts enabled records a `held` row to be swept later.
 */
export async function payoutToSeller(
  stripe: Stripe,
  sb: SupabaseClient,
  input: PayoutInput
): Promise<PayoutResult> {
  const { sourceType, sourceId, sellerProfileId, grossCents, feePct, currency } = input;
  const { feeCents, netCents } = splitCents(grossCents, feePct);

  const ledgerBase = {
    source_type: sourceType,
    source_id: sourceId,
    seller_profile_id: sellerProfileId,
    gross_amount: grossCents / 100,
    platform_fee: feeCents / 100,
    net_to_seller: netCents / 100,
    currency,
  };

  // Short-circuit if this sale was already paid out.
  const { data: existing } = await sb
    .from('platform_fee_ledger')
    .select('stripe_transfer_id, status')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (existing?.status === 'transferred' && existing.stripe_transfer_id) {
    return { status: 'transferred', transferId: existing.stripe_transfer_id };
  }

  const { data: seller } = await sb
    .from('profiles')
    .select('stripe_account_id, payouts_enabled')
    .eq('id', sellerProfileId)
    .single();

  if (!seller?.payouts_enabled || !seller.stripe_account_id) {
    // Hold the earnings until the seller completes onboarding.
    await sb
      .from('platform_fee_ledger')
      .upsert(
        { ...ledgerBase, stripe_transfer_id: null, status: 'held' },
        { onConflict: 'source_type,source_id', ignoreDuplicates: true }
      );
    return { status: 'held', transferId: null };
  }

  const transfer = await stripe.transfers.create(
    {
      amount: netCents,
      currency: currency.toLowerCase(),
      destination: seller.stripe_account_id as string,
      transfer_group: `${sourceType}-${sourceId}`,
      metadata: { source_type: sourceType, source_id: sourceId },
    },
    { idempotencyKey: `${sourceType}-transfer-${sourceId}` }
  );

  await sb
    .from('platform_fee_ledger')
    .upsert(
      { ...ledgerBase, stripe_transfer_id: transfer.id, status: 'transferred' },
      { onConflict: 'source_type,source_id' }
    );

  return { status: 'transferred', transferId: transfer.id };
}

/** Map a Stripe account's capability flags to our onboarding-state enum. */
export function onboardingStateFromAccount(account: Stripe.Account): string {
  if (account.payouts_enabled) return 'enabled';
  if (account.requirements?.disabled_reason) return 'restricted';
  return 'pending';
}

export interface GearTxn {
  id: string;
  listing_id: string;
  payment_intent_id: string | null;
  agreed_price: number;
  platform_fee_pct: number;
  currency: string;
  seller_profile_id: string;
  buyer_profile_id: string;
}

export type ReleaseResult = { released: boolean; held: boolean; reason?: string };

/**
 * Release a gear escrow transaction to the seller: capture the held PaymentIntent,
 * transfer the net via Connect, record the ledger row, and flip the transaction to
 * `released` / listing to `sold`. Shared by the buyer-confirm endpoint and the
 * auto-release cron. Idempotent end to end (PI captured only when requires_capture,
 * ledger unique index + Stripe idempotency key, state-guarded update). Returns
 * held=true without side effects when the seller has not finished onboarding.
 */
export async function releaseGearEscrow(
  stripe: Stripe,
  sb: SupabaseClient,
  txn: GearTxn
): Promise<ReleaseResult> {
  const { data: seller } = await sb
    .from('profiles')
    .select('stripe_account_id, payouts_enabled')
    .eq('id', txn.seller_profile_id)
    .single();
  if (!seller?.payouts_enabled || !seller.stripe_account_id) {
    return { released: false, held: true, reason: 'seller_not_onboarded' };
  }

  // Capture the manual-capture PaymentIntent (only if still authorized).
  if (txn.payment_intent_id) {
    const pi = await stripe.paymentIntents.retrieve(txn.payment_intent_id);
    if (pi.status === 'requires_capture') {
      await stripe.paymentIntents.capture(txn.payment_intent_id);
    }
  }

  await payoutToSeller(stripe, sb, {
    sourceType: 'gear',
    sourceId: txn.id,
    sellerProfileId: txn.seller_profile_id,
    grossCents: Math.round(txn.agreed_price * 100),
    feePct: Number(txn.platform_fee_pct),
    currency: txn.currency,
  });

  await sb
    .from('equipment_transactions')
    .update({
      transaction_state: 'released',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', txn.id)
    .in('transaction_state', ['paid_escrow', 'shipped', 'delivered']);

  await sb.from('equipment_listings').update({ status: 'sold' }).eq('id', txn.listing_id);

  return { released: true, held: false };
}
