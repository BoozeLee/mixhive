// Admin: list all agents with their current version metadata.
// Requires ADMIN_SECRET header — never exposed to the frontend directly;
// the admin UI calls this from a server action or API proxy.

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

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: agents, error } = await serviceClient()
    .from('agent_registry')
    .select('id, display_name, description, tier, approval_policy, timeout_ms, enabled, lua_script_version, updated_at')
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ agents });
}
