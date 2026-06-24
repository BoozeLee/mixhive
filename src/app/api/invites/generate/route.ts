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

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: { label?: string; max_uses?: number; expires_at?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const code = crypto.randomUUID().replace(/-/g, '').toUpperCase();

  const { data, error } = await serviceClient()
    .from('invites')
    .insert({
      code,
      label: body.label ?? null,
      max_uses: body.max_uses ?? 1,
      expires_at: body.expires_at ?? null,
    })
    .select('id, code, label, max_uses, expires_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
