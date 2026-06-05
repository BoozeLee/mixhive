import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

// Daily cron at 02:00 UTC (vercel.json: { "path": "/api/cleanup", "schedule": "0 2 * * *" }).
// Previously declared but unimplemented. Conservative housekeeping only — never
// touches user content. Protected by CRON_SECRET (the self-hosted scheduler and
// Vercel both send Authorization: Bearer <CRON_SECRET>).

export const maxDuration = 30;

const FAILED_JOB_RETENTION_DAYS = 7;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sb = createServerClient();
    const cutoff = new Date(Date.now() - FAILED_JOB_RETENTION_DAYS * 86_400_000).toISOString();
    const result: Record<string, number> = {};

    // 1. Purge old failed audio_jobs (waveforms that exhausted retries).
    const { data: deadJobs } = await sb
      .from('audio_jobs')
      .delete()
      .eq('status', 'failed')
      .lt('updated_at', cutoff)
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

    return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
