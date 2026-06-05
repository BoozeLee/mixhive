// Stripe Connect status: retrieve the user's connected account, sync the cached
// capability flags onto the profile, and report onboarding state to the Earnings UI.
import { NextRequest, NextResponse } from 'next/server';
import {
  getStripe,
  makeUserClient,
  makeServiceClient,
  onboardingStateFromAccount,
} from '@/lib/stripe-connect';
import { handleApiError } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
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
    const { data: profile } = await svc
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    const accountId = profile?.stripe_account_id as string | null | undefined;
    if (!accountId) {
      return NextResponse.json({
        onboarded: false,
        payouts_enabled: false,
        charges_enabled: false,
        requirements_due: [],
      });
    }

    const account = await getStripe().accounts.retrieve(accountId);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const chargesEnabled = Boolean(account.charges_enabled);
    const state = onboardingStateFromAccount(account);

    await svc
      .from('profiles')
      .update({
        payouts_enabled: payoutsEnabled,
        charges_enabled: chargesEnabled,
        connect_onboarding_state: state,
      })
      .eq('id', user.id);

    return NextResponse.json({
      onboarded: true,
      payouts_enabled: payoutsEnabled,
      charges_enabled: chargesEnabled,
      onboarding_state: state,
      requirements_due: account.requirements?.currently_due ?? [],
    });
  } catch (err) {
    return handleApiError(err, 'stripe/connect/status');
  }
}
