import { NextRequest, NextResponse } from 'next/server';
import { redisCache } from '@/lib/redis';

// Auth: prefer the `Authorization: Bearer <jwt>` header (the browser client
// stores its session in localStorage, not a cookie, so there is no
// `sb-*-auth-token` cookie). Fall back to a Supabase auth cookie derived from
// the CURRENT project ref if one exists. The old hardcoded ref pointed at the
// pre-migration project, so every request 401'd.
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

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || user.id;

    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cached = await redisCache.getNotificationsCache(userId).catch(() => null);
    if (cached) {
      return NextResponse.json({ notifications: cached, cached: true });
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*, profiles!notifications_actor_id_fkey(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const notifications = (data || []).map(n => ({
      ...n,
      actor: n.profiles,
    }));

    redisCache.setNotificationsCache(userId, notifications).catch(() => {});

    return NextResponse.json({ notifications, cached: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
