import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

// Read-only health view of the audio queue, so the self-hosted worker tier and
// uptime checks can see whether jobs are draining. No auth (aggregate counts only).

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = createServerClient();

    const count = async (status: string) => {
      const { count } = await sb
        .from('audio_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', status);
      return count ?? 0;
    };

    const [pending, processing, failed] = await Promise.all([
      count('pending'),
      count('processing'),
      count('failed'),
    ]);

    const { data: lastDone } = await sb
      .from('audio_jobs')
      .select('completed_at')
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const queueDepth = pending + processing;
    return NextResponse.json({
      ok: true,
      queue_depth: queueDepth,
      pending,
      processing,
      failed,
      last_completed_at: lastDone?.completed_at ?? null,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
