// Internal agent execution endpoint.
// Only accepts requests carrying the LUA_RUNTIME_SHARED_SECRET so that
// this powerful service-role path is never accidentally exposed to browsers.
// The public-facing entry is /api/agents/test-run which validates the user
// JWT first, then proxies here with the shared secret.

import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '../../../../server/lua-agents/AgentRunner';
import { getPoolStats } from '../../../../server/lua-agents/LuaRuntime';
import type { AgentInput } from '../../../../server/lua-agents/agent.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHARED_SECRET =
  process.env.LUA_RUNTIME_SHARED_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  return SHARED_SECRET.length > 0 && token === SHARED_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const agentId = body.agent_id;
  const profileId = body.profile_id;
  const trigger = body.trigger ?? 'event:user_request';

  if (typeof agentId !== 'string') {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }
  if (typeof profileId !== 'string') {
    return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
  }

  const input: AgentInput = {
    agent_id: agentId as AgentInput['agent_id'],
    profile_id: profileId,
    trigger: trigger as AgentInput['trigger'],
    dry_run: Boolean(body.dry_run),
    context: body.context as Record<string, unknown> | undefined,
  };

  try {
    const output = await runAgent(input);
    return NextResponse.json({ ok: output.status !== 'error', output, pool: getPoolStats() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!SHARED_SECRET) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, pool: getPoolStats() });
}
