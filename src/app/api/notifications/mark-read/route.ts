import { NextRequest, NextResponse } from 'next/server';
import { redisCache } from '@/lib/redis';

// Auth: prefer `Authorization: Bearer <jwt>` (client session lives in
// localStorage, not a cookie). Fall back to a cookie derived from the CURRENT
// project ref. The old hardcoded ref was the pre-migration project → 401s.
function getAccessToken(req: NextRequest): string | null {
  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Bearer ')) return authz.slice(7);
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').match(
    /https?:\/\/([^.]+)\./
  )?.[1];
  const cookie = ref ? req.cookies.get(`sb-${ref}-auth-token`)?.value : undefined;
  if (!cookie) return null;
  try {
    return JSON.parse(decodeURIComponent(cookie))?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = body.userId;
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string').slice(0, 100)
      : [];

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (ids.length) query = query.in('id', ids);
    const { error: updateError } = await query;

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    redisCache.invalidateUserCache(userId).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
