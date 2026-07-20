import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// GDPR Art. 15/20 — let a user download their own data as JSON. Each query is
// scoped to the user and tolerated independently so a single empty/mismatched
// table never fails the whole export.
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    const uid = user.id;

    const grab = async (table: string, column: string) => {
      try {
        const { data } = await sb.from(table).select('*').eq(column, uid);
        return data ?? [];
      } catch {
        return [];
      }
    };
    const grabOne = async (table: string, column: string) => {
      try {
        const { data } = await (sb as SupabaseClient)
          .from(table)
          .select('*')
          .eq(column, uid)
          .maybeSingle();
        return data ?? null;
      } catch {
        return null;
      }
    };

    const [profile, mixes, playlists, comments, follows, consents, agents, notifications, likes] =
      await Promise.all([
        grabOne('profiles', 'id'),
        grab('mixes', 'dj_id'),
        grab('playlists', 'user_id'),
        grab('comments', 'user_id'),
        grab('follows', 'follower_id'),
        grab('user_consents', 'user_id'),
        grab('lua_agent_instances', 'owner_profile_id'),
        grab('notification_preferences', 'user_id'),
        grab('mix_likes', 'user_id'),
      ]);

    const bundle = {
      exported_at: new Date().toISOString(),
      user: { id: uid, email: user.email },
      profile,
      mixes,
      playlists,
      comments,
      follows,
      consents,
      agents,
      notification_preferences: notifications,
      likes,
    };

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="mixhive-data-${uid}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
