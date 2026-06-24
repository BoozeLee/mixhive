import { NextRequest, NextResponse } from 'next/server';
import { makeUserClient } from '@/lib/stripe-connect';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);
    const userClient = makeUserClient(jwt);
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data, error } = await userClient
      .from('user_subscriptions')
      .select('tier, status, current_period_end, stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ tier: 'free', status: 'active', current_period_end: null });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
