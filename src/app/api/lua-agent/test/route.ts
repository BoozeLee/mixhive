// Owner-gated manual test-run for user-authored Lua agents (`lua_agents`).
// The Python runner (/api/lua-agent/run) is service-secret-only and must never be
// reachable from the browser. This route validates the user's JWT, confirms they
// OWN the agent (RLS select), then proxies to the runner with the shared secret.
//
// Distinct from /api/agents/test-run, which targets strategic `agent_registry`
// agents on the wasmoon runtime.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Read config inside the handler so it reflects the live env (and is testable).
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
  const LUA_RUNTIME_SECRET =
    process.env.LUA_RUNTIME_SHARED_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);

  // The user-token client is RLS-scoped: it can only select the caller's own agents.
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const agentId = body.agent_id;
  if (typeof agentId !== 'string') {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }

  // Ownership check via RLS — a non-owner gets no row.
  const { data: agent } = await sb
    .from('lua_agents')
    .select('id, owner_id, trigger_type')
    .eq('id', agentId)
    .maybeSingle();
  if (!agent || agent.owner_id !== user.id) {
    return NextResponse.json({ error: 'agent not found' }, { status: 404 });
  }

  if (!LUA_RUNTIME_SECRET) {
    return NextResponse.json({ error: 'runtime not configured' }, { status: 503 });
  }

  // Drive execution so the agent actually runs: event agents get their entry
  // function invoked (event:<trigger>), manual/null agents run top-to-bottom.
  const trigger = agent.trigger_type;
  const triggeredBy = trigger && trigger !== 'manual' ? `event:${trigger}` : 'manual';
  const callerEvent =
    body.event && typeof body.event === 'object' ? (body.event as Record<string, unknown>) : {};
  const event = { actor_id: user.id, _test: true, ...callerEvent };

  const origin = new URL(req.url).origin;
  const runtimeRes = await fetch(`${origin}/api/lua-agent/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LUA_RUNTIME_SECRET}`,
    },
    body: JSON.stringify({ agent_id: agentId, triggered_by: triggeredBy, event, test: true }),
  });

  const data = await runtimeRes.json().catch(() => ({ error: 'runtime returned invalid json' }));
  return NextResponse.json(data, { status: runtimeRes.status });
}
