import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json();
    const { id, scheduledAt, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Mix id is required' }, { status: 400 });
    }

    if (!scheduledAt || isNaN(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: 'Invalid schedule datetime' }, { status: 400 });
    }

    const minTime = Date.now() + 5 * 60 * 1000;
    if (new Date(scheduledAt).getTime() < minTime) {
      return NextResponse.json(
        { error: 'Schedule time must be at least 5 minutes in the future' },
        { status: 400 }
      );
    }

    const { error } = await sb
      .from('mixes')
      .update({
        ...fields,
        visibility: 'scheduled',
        scheduled_at: new Date(scheduledAt).toISOString(),
      })
      .eq('id', id)
      .eq('dj_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
