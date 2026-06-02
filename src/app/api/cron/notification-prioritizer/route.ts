// Hourly cron: runs notification_prioritizer for recently-active profiles.
// Called by Vercel scheduler at the top of every hour. Auth: Authorization: Bearer $CRON_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAgent } from '@/server/lua-agents/AgentRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ACTIVE_WINDOW_HOURS = 24;
const PROFILE_LIMIT = 200;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_HOURS * 3_600_000).toISOString();
  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id')
    .gte('updated_at', cutoff)
    .limit(PROFILE_LIMIT);

  if (error) {
    console.error('[cron/notification-prioritizer] profile query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let ran = 0;
  let errors = 0;
  for (const profile of profiles ?? []) {
    try {
      await runAgent({
        agent_id: 'notification_prioritizer',
        profile_id: profile.id,
        trigger: 'cron:hourly',
        dry_run: false,
      });
      ran++;
    } catch (err) {
      errors++;
      console.error(`[cron/notification-prioritizer] ${profile.id}:`, err);
    }
  }

  return NextResponse.json({ ran, errors, profiles: profiles?.length ?? 0 });
}
