// Hourly cron: batch-send push notifications for users with unread notifications
// created in the last 65 minutes. One push per user with the top unread item.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_TOKEN!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const NOTIFICATION_TYPE_TITLES: Record<string, string> = {
  like: '🎵 Someone liked your mix',
  follow: '🐝 New follower',
  comment: '💬 New comment',
  reply: '↩️ New reply',
  mix_upload: '🎧 New mix from someone you follow',
  mention: '📣 You were mentioned',
  buzz_like: '🐝 Someone liked your Buzz',
  repost: '🔁 Your mix was reposted',
  agent_purchased: '✦ Agent purchase complete',
  agent_sale: '✦ Your agent was purchased',
  gear_sale: '📦 Gear listing sold',
};

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = makeServiceClient();
  const since = new Date(Date.now() - 65 * 60 * 1000).toISOString();

  // Find users who have push subscriptions AND recent unread notifications
  const { data: rows, error } = await sb
    .from('notifications')
    .select('user_id, type, data, created_at')
    .eq('read', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ sent: 0, errors: 0 });

  // Group by user, keep only the most recent notification per user
  const byUser = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, row);
  }

  const origin = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'https://mixhive.vercel.app';
  const pushUrl = `${origin}/api/push/send`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };

  let sent = 0;
  let errors = 0;

  await Promise.all(
    [...byUser.entries()].map(async ([user_id, notif]) => {
      const title = NOTIFICATION_TYPE_TITLES[notif.type] ?? 'New notification from MixHive';
      const body = (notif.data as { message?: string })?.message ?? '';

      try {
        const res = await fetch(pushUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id, title, body, url: '/notifications' }),
        });
        if (res.ok) sent++;
        else errors++;
      } catch {
        errors++;
      }
    })
  );

  return NextResponse.json({ sent, errors });
}
