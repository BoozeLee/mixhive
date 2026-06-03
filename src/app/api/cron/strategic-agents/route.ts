// Daily cron: runs scene_radar and trend_intelligence for recently-active profiles.
// Weekly (Monday only): also runs mythic_strategist for each active profile.
// Called by Vercel scheduler at 07:00 UTC. Auth: Authorization: Bearer $CRON_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAgent } from '@/server/lua-agents/AgentRunner';
import type { AgentId } from '@/server/lua-agents/agent.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DAILY_AGENTS: AgentId[] = ['scene_radar', 'trend_intelligence'];
// Runs only on Mondays (getDay() === 1) to avoid daily LLM cost × 200 profiles.
const WEEKLY_AGENTS: AgentId[] = ['mythic_strategist'];
const ACTIVE_WINDOW_DAYS = 7;
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

  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id')
    .gte('updated_at', cutoff)
    .limit(PROFILE_LIMIT);

  if (error) {
    console.error('[cron/strategic-agents] profile query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const isMonday = new Date().getDay() === 1;
  const agentsToRun: AgentId[] = isMonday ? [...DAILY_AGENTS, ...WEEKLY_AGENTS] : DAILY_AGENTS;

  let ran = 0;
  let errors = 0;
  for (const profile of profiles ?? []) {
    for (const agentId of agentsToRun) {
      const trigger = WEEKLY_AGENTS.includes(agentId) ? 'cron:weekly' : 'cron:daily';
      try {
        await runAgent({
          agent_id: agentId,
          profile_id: profile.id,
          trigger,
          dry_run: false,
        });
        ran++;
      } catch (err) {
        errors++;
        console.error(`[cron/strategic-agents] ${agentId} ${profile.id}:`, err);
      }
    }
  }

  return NextResponse.json({ ran, errors, profiles: profiles?.length ?? 0 });
}
