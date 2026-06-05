// Stripe Connect onboarding: create (or reuse) an Express connected account for
// the authenticated user and return a fresh, single-use Account Link to complete
// onboarding. Sensitive Connect columns are written with the service role only.
import { NextRequest, NextResponse } from 'next/server';
import { getStripe, makeUserClient, makeServiceClient } from '@/lib/stripe-connect';
import { handleApiError } from '@/lib/api-errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
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

    const stripe = getStripe();
    const svc = makeServiceClient();

    // Reuse an existing connected account if the profile already has one.
    const { data: profile } = await svc
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    let accountId = profile?.stripe_account_id as string | null | undefined;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        ...(user.email ? { email: user.email } : {}),
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: { profile_id: user.id },
      });
      accountId = account.id;
      await svc
        .from('profiles')
        .update({ stripe_account_id: accountId, connect_onboarding_state: 'pending' })
        .eq('id', user.id);
    }

    const origin = req.headers.get('origin') || 'https://mixhive.vercel.app';
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${origin}/earnings?connect=refresh`,
      return_url: `${origin}/earnings?connect=return`,
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    return handleApiError(err, 'stripe/connect/onboard');
  }
}
