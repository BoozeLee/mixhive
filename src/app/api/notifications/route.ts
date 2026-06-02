import { NextRequest, NextResponse } from 'next/server';
import { redisCache } from '@/lib/redis';

const AUTH_COOKIE_NAME = 'sb-wlfjbzdzmrqiiguyoulj-auth-token';

export async function GET(req: NextRequest) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    const authToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = JSON.parse(decodeURIComponent(authToken));
    const accessToken = parsed?.access_token;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
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
