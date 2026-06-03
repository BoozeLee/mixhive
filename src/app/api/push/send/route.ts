// Internal endpoint: send a web push to all subscriptions for a given user.
// Called by the push-sender cron. Requires CRON_SECRET authorization.
// Removes stale subscriptions automatically (HTTP 410 from push service).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const runtime = 'nodejs';

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_TOKEN!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function configureVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    configureVapid();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'VAPID not configured';
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  try {
    const { user_id, title, body, url } = await req.json();
    if (!user_id || !title) {
      return NextResponse.json({ error: 'user_id and title required' }, { status: 400 });
    }

    const sb = makeServiceClient();
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id);

    if (error) throw error;
    if (!subs?.length) return NextResponse.json({ sent: 0 });

    const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/notifications' });
    const staleIds: string[] = [];
    let sent = 0;

    await Promise.all(
      subs.map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
          await sb
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);
        } catch (e: unknown) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) staleIds.push(sub.id);
        }
      })
    );

    if (staleIds.length) {
      await sb.from('push_subscriptions').delete().in('id', staleIds);
    }

    return NextResponse.json({ sent, stale_removed: staleIds.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
