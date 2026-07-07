// Public-facing agent test-run endpoint.
// Validates the caller's JWT, checks agent ownership / access rights,
// then proxies to the internal /api/lua-agent/run endpoint with the
// shared secret so the powerful Lua runner is never directly reachable.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSubscription } from '@/lib/subscription';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const LUA_RUNTIME_SECRET =
  process.env.LUA_RUNTIME_SHARED_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);

  // Validate JWT via Supabase anon client (forwards the user token)
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

  // Verify agent exists in the registry and is enabled
  const { data: agent } = await sb
    .from('agent_registry')
    .select('id, tier, enabled')
    .eq('id', agentId)
    .eq('enabled', true)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ error: 'agent not found or disabled' }, { status: 404 });
  }

  // Pro/partner agents require supporter+ subscription
  if (agent.tier && agent.tier !== 'free') {
    const gate = await requireSubscription(token, 'supporter');
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error, requiredTier: 'supporter' },
        { status: gate.status }
      );
    }
  }

  const origin = new URL(req.url).origin;
  const runtimeRes = await fetch(`${origin}/api/lua-agent/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LUA_RUNTIME_SECRET}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      profile_id: user.id,
      trigger: 'event:user_request',
      dry_run: body.dry_run ?? false,
      context: body.context ?? {},
    }),
  });

  const data = await runtimeRes.json();
  return NextResponse.json(data, { status: runtimeRes.status });
}
