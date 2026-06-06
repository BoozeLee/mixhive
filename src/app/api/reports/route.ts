import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// User-facing content reports. Verifies the reporter's session, applies a
// server-side per-user rate limit (genuine — not the client-side fail-open
// check), then records a moderation_signals row via the service role (the table
// is service-role-only by RLS). Admins action these from /admin/moderation.

const ALLOWED_SOURCES = ['buzzes', 'mixes', 'profiles', 'equipment_listings'];
const REPORTS_PER_HOUR = 10;

function envUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

export async function POST(req: NextRequest) {
  try {
    const url = envUrl();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    // Verify the reporter via their own token.
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { source_table, source_id, reason } = await req.json();
    if (!source_table || !source_id) {
      return NextResponse.json(
        { error: 'source_table and source_id are required' },
        { status: 400 }
      );
    }
    if (!ALLOWED_SOURCES.includes(source_table)) {
      return NextResponse.json({ error: 'Unsupported source_table' }, { status: 400 });
    }

    // Server-side rate limit (Redis sorted-set window). Fail-open if Redis is down.
    try {
      const { redisCache } = await import('@/lib/redis');
      const rl = await redisCache.incrementRateLimit(`reports:${user.id}`, REPORTS_PER_HOUR, 3600);
      if (rl.current > REPORTS_PER_HOUR) {
        return NextResponse.json({ error: 'Too many reports, try later' }, { status: 429 });
      }
    } catch {
      /* fail-open */
    }

    const service = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Ignore a duplicate still-open report from the same reporter on the same target.
    const { data: existing } = await service
      .from('moderation_signals')
      .select('id')
      .eq('source_table', source_table)
      .eq('source_id', source_id)
      .eq('flagged_by', user.id)
      .eq('status', 'open')
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }

    const { data, error } = await service
      .from('moderation_signals')
      .insert({
        source_table,
        source_id,
        signal_type: 'user_report',
        severity: 'low',
        status: 'open',
        flagged_by: user.id,
        payload: { reason: typeof reason === 'string' ? reason.slice(0, 1000) : '', reporter_id: user.id },
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to file report' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
