// Admin: promote a script version to live (updates agent_registry.lua_script).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function isAdmin(req: NextRequest): boolean {
  const h = req.headers.get('x-admin-secret') ?? '';
  return ADMIN_SECRET.length > 0 && h === ADMIN_SECRET;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;

  let body: { version: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (typeof body.version !== 'number') {
    return NextResponse.json({ error: 'version (number) required' }, { status: 400 });
  }

  const sb = serviceClient();

  const { data: ver, error: verErr } = await sb
    .from('agent_script_versions')
    .select('lua_script, version')
    .eq('agent_id', id)
    .eq('version', body.version)
    .maybeSingle();

  if (verErr || !ver) {
    return NextResponse.json({ error: 'version not found' }, { status: 404 });
  }

  // Write the script to the live registry
  const { error: regErr } = await sb
    .from('agent_registry')
    .update({ lua_script: ver.lua_script, lua_script_version: ver.version, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  // Mark the version as promoted
  await sb
    .from('agent_script_versions')
    .update({ promoted_at: new Date().toISOString(), rolled_back_at: null })
    .eq('agent_id', id)
    .eq('version', body.version);

  // Invalidate AgentRegistry in-process cache by reloading (best-effort — cold start picks it up)
  const { _cache } = await import('../../../../../../server/lua-agents/AgentRegistry');
  if (_cache && typeof _cache.delete === 'function') _cache.delete(id);

  return NextResponse.json({ ok: true, promoted_version: body.version });
}
