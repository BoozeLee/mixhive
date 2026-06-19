import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 20;
const RATE_WINDOW = 60; // seconds

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const rl = await redisCache.incrementRateLimit(`invite_check:${ip}`, RATE_LIMIT, RATE_WINDOW);
  if (rl.current > rl.limit) {
    return NextResponse.json({ valid: false }, {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)),
        'X-RateLimit-Limit': String(rl.limit),
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  const code = req.nextUrl.searchParams.get('code')?.toUpperCase();
  if (!code) return NextResponse.json({ valid: false }, { status: 400 });

  const { data, error } = await anonClient()
    .from('invites')
    .select('id, label, max_uses, uses_count, expires_at, is_active')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (error) return NextResponse.json({ valid: false }, { status: 500 });
  if (!data) return NextResponse.json({ valid: false });

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false });
  }
  if (data.uses_count >= data.max_uses) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    label: data.label,
    uses_remaining: data.max_uses - data.uses_count,
  });
}
