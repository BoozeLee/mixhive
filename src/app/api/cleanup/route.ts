import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

// Daily cron at 02:00 UTC (vercel.json: { "path": "/api/cleanup", "schedule": "0 2 * * *" }).
// Housekeeping + GDPR retention automation. Protected by CRON_SECRET.

export const maxDuration = 60;

const FAILED_JOB_RETENTION_DAYS = 7;
const READ_NOTIFICATION_RETENTION_DAYS = 90;
const UNREAD_NOTIFICATION_RETENTION_DAYS = 180;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sb = createServerClient();
    const result: Record<string, number> = {};

    // 1. Purge old failed audio_jobs (waveforms that exhausted retries).
    const failedCutoff = new Date(
      Date.now() - FAILED_JOB_RETENTION_DAYS * 86_400_000
    ).toISOString();
    const { data: deadJobs } = await sb
      .from('audio_jobs')
      .delete()
      .eq('status', 'failed')
      .lt('updated_at', failedCutoff)
      .select('id');
    result.failed_audio_jobs_removed = deadJobs?.length ?? 0;

    // 2. Re-queue stuck 'processing' jobs older than 1h (worker likely died mid-job).
    const stuckCutoff = new Date(Date.now() - 3_600_000).toISOString();
    const { data: requeued } = await sb
      .from('audio_jobs')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lt('started_at', stuckCutoff)
      .select('id');
    result.stuck_jobs_requeued = requeued?.length ?? 0;

    // 3. GDPR retention — purge old read notifications.
    const readNotifCutoff = new Date(
      Date.now() - READ_NOTIFICATION_RETENTION_DAYS * 86_400_000
    ).toISOString();
    const { data: oldReadNotifications } = await sb
      .from('notifications')
      .delete()
      .eq('read', true)
      .lt('created_at', readNotifCutoff)
      .select('id');
    result.old_read_notifications_removed = oldReadNotifications?.length ?? 0;

    // 4. GDPR retention — purge old unread notifications.
    const unreadNotifCutoff = new Date(
      Date.now() - UNREAD_NOTIFICATION_RETENTION_DAYS * 86_400_000
    ).toISOString();
    const { data: oldUnreadNotifications } = await sb
      .from('notifications')
      .delete()
      .eq('read', false)
      .lt('created_at', unreadNotifCutoff)
      .select('id');
    result.old_unread_notifications_removed = oldUnreadNotifications?.length ?? 0;

    return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
