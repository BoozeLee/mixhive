// Hive Composer "Analyse my set" — JWT-validated proxy to the wasmoon runtime.
// set_composer_agent is a system agent (no per-user ownership). The browser must
// never call the secret-gated /api/lua-agent/execute directly, so this route
// validates the user's session and proxies with the shared secret.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

  const mixIds = body.mix_ids;
  if (!Array.isArray(mixIds) || mixIds.length === 0) {
    return NextResponse.json({ error: 'mix_ids required' }, { status: 400 });
  }
  const bpmMap =
    body.bpm_map && typeof body.bpm_map === 'object'
      ? (body.bpm_map as Record<string, unknown>)
      : {};

  if (!LUA_RUNTIME_SECRET) {
    return NextResponse.json({ error: 'runtime not configured' }, { status: 503 });
  }

  const origin = new URL(req.url).origin;
  const runtimeRes = await fetch(`${origin}/api/lua-agent/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LUA_RUNTIME_SECRET}`,
    },
    body: JSON.stringify({
      agent_id: 'set_composer_agent',
      profile_id: user.id,
      trigger: 'event:user_request',
      context: { mix_ids: mixIds, bpm_map: bpmMap },
    }),
  });

  const data = await runtimeRes.json().catch(() => null);
  if (!runtimeRes.ok || !data) {
    return NextResponse.json(
      { error: data?.error ?? 'analysis failed' },
      { status: runtimeRes.status || 500 }
    );
  }
  return NextResponse.json({ suggestions: data.output?.suggestions ?? [] });
}
