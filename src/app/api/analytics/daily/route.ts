import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

// Daily cron at 00:00 UTC (vercel.json: { "path": "/api/analytics/daily", "schedule": "0 0 * * *" }).
// Previously declared but unimplemented. Snapshots get_hive_stats() into
// daily_platform_stats (migration 083) — one row per day — for growth charts.
// Protected by CRON_SECRET.

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sb = createServerClient();
    const { data, error } = await sb.rpc('get_hive_stats');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;

    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const snapshot = {
      day,
      mixes_total: Number(row?.mixes_total ?? 0),
      voices_total: Number(row?.voices_total ?? 0),
      plays_total: Number(row?.plays_total ?? 0),
      live_now: Number(row?.live_now ?? 0),
    };

    const { error: upsertErr } = await sb
      .from('daily_platform_stats')
      .upsert(snapshot, { onConflict: 'day' });
    if (upsertErr) throw upsertErr;

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    return handleApiError(err);
  }
}
