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

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_TOKEN!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const sb = makeClient(authHeader.slice(7));

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const body = await req.json();
    const { endpoint, p256dh, auth, user_agent } = body;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 });
    }

    const service = makeServiceClient();
    const { error } = await service.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: user_agent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) throw error;
    await service
      .from('notification_preferences')
      .upsert(
        { user_id: user.id, push_enabled: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : ((err as { message?: string }).message ?? 'Unknown error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const sb = makeClient(authHeader.slice(7));

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const body = await req.json();
    const { endpoint } = body;
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

    const service = makeServiceClient();
    const { error } = await service
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (error) throw error;
    const { count } = await service
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (!count) {
      await service
        .from('notification_preferences')
        .upsert(
          { user_id: user.id, push_enabled: false, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : ((err as { message?: string }).message ?? 'Unknown error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
