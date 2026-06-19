import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 20 req/min per IP, 30 req/min per code (secondary — code is attacker-invariant)
const IP_LIMIT = 20;
const CODE_LIMIT = 30;
const WINDOW = 60;

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function clientIp(req: NextRequest): string {
  // req.ip is set by Vercel's trusted edge and cannot be spoofed by clients.
  // x-real-ip is the same value; XFF leftmost entry is user-controllable and not used.
  return (req as unknown as { ip?: string }).ip
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.toUpperCase();
  if (!code) return NextResponse.json({ valid: false }, { status: 400 });

  const ip = clientIp(req);

  // Fail-closed: 503 if Redis is unreachable (prevents brute-force during outages)
  const [ipRl, codeRl] = await Promise.all([
    redisCache.strictRateLimit(`invite_check:ip:${ip}`, IP_LIMIT, WINDOW),
    redisCache.strictRateLimit(`invite_check:code:${code}`, CODE_LIMIT, WINDOW),
  ]);

  if (ipRl === null || codeRl === null) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  if (ipRl.current > ipRl.limit || codeRl.current > codeRl.limit) {
    return NextResponse.json({ valid: false }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((ipRl.reset - Date.now()) / 1000)) },
    });
  }

  const { data, error } = await anonClient()
    .from('invites')
    .select('id, label, max_uses, uses_count, expires_at, is_active')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (error) return NextResponse.json({ valid: false }, { status: 500 });
  if (!data) return NextResponse.json({ valid: false });
  if (data.expires_at && new Date(data.expires_at) < new Date()) return NextResponse.json({ valid: false });
  if (data.uses_count >= data.max_uses) return NextResponse.json({ valid: false });

  return NextResponse.json({
    valid: true,
    label: data.label,
    uses_remaining: data.max_uses - data.uses_count,
  });
}
