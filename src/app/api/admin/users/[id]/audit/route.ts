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

  const sb = serviceClient();
  const { data: entries, error } = await sb
    .from('moderation_signals')
    .select('*')
    .eq('source_table', 'profiles')
    .eq('source_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entries: entries || [] });
}