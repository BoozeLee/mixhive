import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.toUpperCase();
  if (!code) return NextResponse.json({ valid: false, reason: 'missing_code' }, { status: 400 });

  const { data, error } = await anonClient()
    .from('invites')
    .select('id, label, max_uses, uses_count, expires_at, is_active')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (error) return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 });
  if (!data) return NextResponse.json({ valid: false, reason: 'not_found' });

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' });
  }
  if (data.uses_count >= data.max_uses) {
    return NextResponse.json({ valid: false, reason: 'exhausted' });
  }

  return NextResponse.json({
    valid: true,
    label: data.label,
    uses_remaining: data.max_uses - data.uses_count,
  });
}
