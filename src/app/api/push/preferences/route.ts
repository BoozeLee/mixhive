import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeClient(jwt: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

async function authenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const sb = makeClient(authHeader.slice(7));
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  return error || !user ? null : { sb, user };
}

export async function GET(req: NextRequest) {
  const ctx = await authenticatedClient(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [{ data: preferences, error }, { count }] = await Promise.all([
    ctx.sb.from('notification_preferences').select('*').eq('user_id', ctx.user.id).maybeSingle(),
    ctx.sb
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    preferences: preferences ?? {
      user_id: ctx.user.id,
      push_enabled: false,
      messages_enabled: true,
      social_enabled: true,
      uploads_enabled: true,
      account_enabled: true,
    },
    subscribed: Boolean(count),
  });
}

export async function PUT(req: NextRequest) {
  const ctx = await authenticatedClient(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const allowed = [
    'push_enabled',
    'messages_enabled',
    'social_enabled',
    'uploads_enabled',
    'account_enabled',
  ] as const;
  const updates = Object.fromEntries(
    allowed.filter(key => typeof body[key] === 'boolean').map(key => [key, body[key]])
  );
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No valid preferences supplied' }, { status: 400 });
  }

  const { data, error } = await ctx.sb
    .from('notification_preferences')
    .upsert(
      { user_id: ctx.user.id, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
