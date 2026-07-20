import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError, unauthorized } from '@/lib/api-errors';

function makeClient(jwt?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, {
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
    auth: { persistSession: false },
  });
}

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const authHeader = _req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return unauthorized();
    const jwt = authHeader.slice(7);

    const sb = makeClient(jwt);
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) return unauthorized();

    // Mark as left
    const { error: updErr } = await sb
      .from('live_room_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('room_id', id)
      .eq('user_id', user.id)
      .is('left_at', null);

    if (updErr) throw updErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'live-rooms:leave');
  }
}
