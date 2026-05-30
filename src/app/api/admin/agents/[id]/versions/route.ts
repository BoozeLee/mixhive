// Admin: list versions for an agent, or create a new draft version.

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;

  const { data, error } = await serviceClient()
    .from('agent_script_versions')
    .select('id, version, notes, author, promoted_at, rolled_back_at, created_at')
    .eq('agent_id', id)
    .order('version', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;

  let body: { lua_script: string; notes?: string; author?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.lua_script || typeof body.lua_script !== 'string') {
    return NextResponse.json({ error: 'lua_script required' }, { status: 400 });
  }

  const sb = serviceClient();

  // Verify agent exists
  const { data: agent } = await sb
    .from('agent_registry')
    .select('id, lua_script_version')
    .eq('id', id)
    .maybeSingle();

  if (!agent) return NextResponse.json({ error: 'agent not found' }, { status: 404 });

  const nextVersion = (agent.lua_script_version ?? 1) + 1;

  const { data: version, error } = await sb
    .from('agent_script_versions')
    .insert({
      agent_id:   id,
      version:    nextVersion,
      lua_script: body.lua_script,
      notes:      body.notes ?? null,
      author:     body.author ?? 'admin',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ version }, { status: 201 });
}
