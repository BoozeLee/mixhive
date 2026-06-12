import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import {
  categoryPreferenceKey,
  notificationPresentation,
  type NotificationCategory,
} from '@/lib/notificationPresentation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Preference = {
  user_id: string;
  push_enabled: boolean;
  messages_enabled: boolean;
  social_enabled: boolean;
  uploads_enabled: boolean;
  account_enabled: boolean;
};

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_TOKEN!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function configureVapid() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) throw new Error('VAPID keys not configured');
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function categoryEnabled(preference: Preference | undefined, category: NotificationCategory) {
  if (preference && !preference.push_enabled) return false;
  return preference ? preference[categoryPreferenceKey(category)] : true;
}

function hourKey(value: string) {
  return new Date(value).toISOString().slice(0, 13);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    configureVapid();
    const sb = makeServiceClient();
    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setUTCMinutes(0, 0, 0);
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: notifications, error: notificationError },
      { data: subscriptions },
      { data: preferences },
    ] = await Promise.all([
      sb
        .from('notifications')
        .select(
          'id,user_id,type,actor_id,mix_id,buzz_id,data,body,metadata,created_at,profiles!notifications_actor_id_fkey(username,display_name)'
        )
        .eq('read', false)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(1000),
      sb.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth'),
      sb.from('notification_preferences').select('*'),
    ]);
    if (notificationError) throw notificationError;

    const subsByUser = new Map<string, Subscription[]>();
    for (const sub of (subscriptions ?? []) as Subscription[]) {
      subsByUser.set(sub.user_id, [...(subsByUser.get(sub.user_id) ?? []), sub]);
    }
    const prefsByUser = new Map(
      ((preferences ?? []) as Preference[]).map(preference => [preference.user_id, preference])
    );

    let enqueued = 0;
    const digests = new Map<
      string,
      { userId: string; category: NotificationCategory; count: number; createdAt: string }
    >();

    for (const raw of notifications ?? []) {
      const notification = {
        ...raw,
        data: {
          ...((raw.metadata as Record<string, unknown> | null) ?? {}),
          ...((raw.data as Record<string, unknown> | null) ?? {}),
          ...(raw.body ? { body: raw.body } : {}),
        },
        actor: raw.profiles,
      };
      const presentation = notificationPresentation(notification);
      if (!categoryEnabled(prefsByUser.get(raw.user_id), presentation.category)) continue;

      if (presentation.urgency === 'digest') {
        if (new Date(raw.created_at).getTime() >= currentHour.getTime()) continue;
        const key = `${raw.user_id}:${presentation.category}:${hourKey(raw.created_at)}`;
        const digest = digests.get(key);
        if (digest) digest.count += 1;
        else
          digests.set(key, {
            userId: raw.user_id,
            category: presentation.category,
            count: 1,
            createdAt: raw.created_at,
          });
        continue;
      }

      for (const sub of subsByUser.get(raw.user_id) ?? []) {
        const { error } = await sb.from('push_delivery_jobs').insert({
          user_id: raw.user_id,
          subscription_id: sub.id,
          notification_id: raw.id,
          payload: { ...presentation, tag: `notification-${raw.id}` },
        });
        if (!error) enqueued += 1;
        else if (error.code !== '23505') console.error('[push-sender] enqueue:', error.message);
      }
    }

    for (const [digestKey, digest] of digests) {
      for (const sub of subsByUser.get(digest.userId) ?? []) {
        const label = digest.category === 'uploads' ? 'new mixes' : 'new social updates';
        const { error } = await sb.from('push_delivery_jobs').insert({
          user_id: digest.userId,
          subscription_id: sub.id,
          digest_key: digestKey,
          payload: {
            title: 'Your MixHive activity',
            body: `${digest.count} ${label}`,
            url: '/notifications',
            tag: `digest-${digestKey}`,
          },
        });
        if (!error) enqueued += 1;
        else if (error.code !== '23505')
          console.error('[push-sender] digest enqueue:', error.message);
      }
    }

    const { data: jobs, error: jobsError } = await sb
      .from('push_delivery_jobs')
      .select('id,attempts,payload,push_subscriptions!inner(id,endpoint,p256dh,auth)')
      .in('status', ['pending', 'failed'])
      .lt('attempts', 5)
      .lte('next_attempt_at', now.toISOString())
      .order('created_at', { ascending: true })
      .limit(100);
    if (jobsError) throw jobsError;

    let delivered = 0;
    let retried = 0;
    let staleRemoved = 0;
    for (const job of jobs ?? []) {
      const { data: claimed } = await sb
        .from('push_delivery_jobs')
        .update({ status: 'processing' })
        .eq('id', job.id)
        .in('status', ['pending', 'failed'])
        .select('id')
        .maybeSingle();
      if (!claimed) continue;

      const sub = job.push_subscriptions as unknown as Subscription;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(job.payload)
        );
        delivered += 1;
        await Promise.all([
          sb
            .from('push_delivery_jobs')
            .update({
              status: 'delivered',
              delivered_at: new Date().toISOString(),
              last_error: null,
            })
            .eq('id', job.id),
          sb
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id),
        ]);
      } catch (error: unknown) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          staleRemoved += 1;
          await sb.from('push_subscriptions').delete().eq('id', sub.id);
          continue;
        }
        const attempts = job.attempts + 1;
        const delayMinutes = Math.min(60, 2 ** attempts);
        retried += 1;
        await sb
          .from('push_delivery_jobs')
          .update({
            status: 'failed',
            attempts,
            next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
            last_error: error instanceof Error ? error.message.slice(0, 500) : 'Push failed',
          })
          .eq('id', job.id);
      }
    }

    return NextResponse.json({
      enqueued,
      claimed: jobs?.length ?? 0,
      delivered,
      retried,
      stale_removed: staleRemoved,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Push sender failed' },
      { status: 500 }
    );
  }
}
