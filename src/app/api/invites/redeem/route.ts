import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError } from '@/lib/api-errors';
import { redisCache } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 5 attempts per user per minute — keyed on JWT-validated user.id (cannot be rotated)
const USER_LIMIT = 5;
const WINDOW = 60;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function anonClient(jwt: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    // Auth first — rate limit key is the JWT-validated user.id (cannot be spoofed)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const { data: { user }, error: authError } = await anonClient(jwt).auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    // Fail-closed rate limit keyed on server-validated user.id
    const rl = await redisCache.strictRateLimit(`invite_redeem:user:${user.id}`, USER_LIMIT, WINDOW);
    if (rl === null) {
      return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
    }
    if (rl.current > rl.limit) {
      return NextResponse.json({ error: 'rate_limited' }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
      });
    }

    const body: { code?: string } = await req.json().catch(() => ({}));
    if (!body.code) {
      return NextResponse.json({ error: 'missing_code' }, { status: 400 });
    }

    const { data, error } = await serviceClient().rpc('redeem_invite', {
      p_code: body.code.toUpperCase(),
      p_user_id: user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = data as { ok: boolean; error?: string; xp?: number; level?: number };
    if (!result.ok) {
      const status = result.error === 'already_used' ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true, xp: result.xp, level: result.level });
  } catch (err) {
    return handleApiError(err);
  }
}
