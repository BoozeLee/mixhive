import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, makeServiceClient } from '@/lib/stripe-connect';

export const runtime = 'nodejs';

const TIER_MAP: Record<string, string> = {
  supporter: 'supporter',
  insider: 'insider',
  patron: 'patron',
};

function tierFromPrice(priceId: string): string {
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith('STRIPE_PRICE_') && val === priceId) {
      return TIER_MAP[key.replace('STRIPE_PRICE_', '').toLowerCase()] || 'free';
    }
  }
  return 'free';
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 });
  }

  const sb = makeServiceClient();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(sb, event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(sb, event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(sb, event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoiceFailed(sb, event.data.object as Stripe.Invoice);
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionChange(
  sb: ReturnType<typeof makeServiceClient>,
  sub: Stripe.Subscription
) {
  const userId = sub.metadata?.userId || (await userIdFromCustomer(sb, sub.customer as string));
  if (!userId) return;

  const tier = sub.items.data[0]?.price?.id ? tierFromPrice(sub.items.data[0].price.id) : 'free';

  await sb.from('user_subscriptions').upsert(
    {
      user_id: userId,
      tier,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: new Date((sub.current_period_end || 0) * 1000).toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

async function handleSubscriptionDeleted(
  sb: ReturnType<typeof makeServiceClient>,
  sub: Stripe.Subscription
) {
  const userId = sub.metadata?.userId || (await userIdFromCustomer(sb, sub.customer as string));
  if (!userId) return;

  await sb
    .from('user_subscriptions')
    .update({ tier: 'free', status: 'canceled' })
    .eq('user_id', userId);
}

async function handleInvoicePaid(
  sb: ReturnType<typeof makeServiceClient>,
  invoice: Stripe.Invoice
) {
  const subId = invoice.subscription as string;
  if (!subId) return;

  const { data } = await sb
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subId)
    .single();

  if (data?.user_id) {
    await sb.from('user_subscriptions').update({ status: 'active' }).eq('user_id', data.user_id);
  }
}

async function handleInvoiceFailed(
  sb: ReturnType<typeof makeServiceClient>,
  invoice: Stripe.Invoice
) {
  const subId = invoice.subscription as string;
  if (!subId) return;

  const { data } = await sb
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subId)
    .single();

  if (data?.user_id) {
    await sb.from('user_subscriptions').update({ status: 'past_due' }).eq('user_id', data.user_id);
  }
}

async function userIdFromCustomer(
  sb: ReturnType<typeof makeServiceClient>,
  customerId: string
): Promise<string | null> {
  const { data } = await sb
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  return data?.id || null;
}
