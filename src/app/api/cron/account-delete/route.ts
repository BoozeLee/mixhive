import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export const maxDuration = 60;

// Daily cron at 03:00 UTC — hard-deletes users whose 30-day grace window has expired.
// Protected by CRON_SECRET (same as /api/cleanup).

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sb = createServerClient();
    const now = new Date().toISOString();

    const { data: requests } = await sb
      .from('deletion_requests')
      .select('id, user_id')
      .eq('status', 'requested')
      .lte('process_after', now);

    if (!requests || requests.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processed = 0;
    const errors: { userId: string; error: string }[] = [];

    for (const req of requests) {
      try {
        await sb.auth.admin.deleteUser(req.user_id);
        await sb.from('deletion_requests').update({ status: 'done' }).eq('id', req.id);
        processed++;
      } catch (err) {
        errors.push({
          userId: req.user_id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
