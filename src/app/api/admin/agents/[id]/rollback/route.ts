// Admin: roll back an agent to the previous promoted version.

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

  const sb = serviceClient();

  // Find the current live version
  const { data: agent } = await sb
    .from('agent_registry')
    .select('lua_script_version')
    .eq('id', id)
    .maybeSingle();

  if (!agent) return NextResponse.json({ error: 'agent not found' }, { status: 404 });

  const currentVersion = agent.lua_script_version ?? 1;

  // Mark current version as rolled back
  await sb
    .from('agent_script_versions')
    .update({ rolled_back_at: new Date().toISOString() })
    .eq('agent_id', id)
    .eq('version', currentVersion);

  if (currentVersion <= 1) {
    return NextResponse.json({ error: 'already at version 1, cannot roll back further' }, { status: 409 });
  }

  // Find the highest promoted version before current that is not rolled back
  const { data: prev } = await sb
    .from('agent_script_versions')
    .select('lua_script, version')
    .eq('agent_id', id)
    .not('promoted_at', 'is', null)
    .is('rolled_back_at', null)
    .lt('version', currentVersion)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prev) {
    return NextResponse.json({ error: 'no previous promoted version found to roll back to' }, { status: 409 });
  }

  const { error: regErr } = await sb
    .from('agent_registry')
    .update({ lua_script: prev.lua_script, lua_script_version: prev.version, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 });

  const { _cache } = await import('../../../../../../server/lua-agents/AgentRegistry');
  if (_cache && typeof _cache.delete === 'function') _cache.delete(id);

  return NextResponse.json({ ok: true, rolled_back_to: prev.version });
}
