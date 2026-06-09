import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Record a cookie/consent choice (GDPR Art. 7). Works for anonymous visitors
// (anon key, null user_id) and signed-in users (JWT → own user_id).
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      ...(jwt ? { global: { headers: { Authorization: `Bearer ${jwt}` } } } : {}),
    });

    let userId: string | null = null;
    if (jwt) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      userId = user?.id ?? null;
    }

    const body = await req.json().catch(() => ({}));
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const row = {
      user_id: userId,
      necessary: true,
      analytics: !!body.analytics,
      marketing: !!body.marketing,
      policy_version: typeof body.policyVersion === 'string' ? body.policyVersion : 'v1',
      ip,
      user_agent: req.headers.get('user-agent'),
    };

    const { error } = await sb.from('user_consents').insert(row);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
