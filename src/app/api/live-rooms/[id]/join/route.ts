import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// Private-room access is enforced by the live_rooms SELECT policy (migration
// 112): a non-member simply cannot read the row, so the lookup below fails
// before capacity is ever considered. No separate forbidden() branch needed.
import { handleApiError, unauthorized, badRequest } from '@/lib/api-errors';

function makeClient(jwt?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, {
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
    auth: { persistSession: false },
  });
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authHeader = _req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return unauthorized();
    const jwt = authHeader.slice(7);

    const sb = makeClient(jwt);
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return unauthorized();

    // Check room exists and is joinable
    const { data: room } = await sb
      .from('live_rooms')
      .select('status, max_participants')
      .eq('id', id)
      .maybeSingle();

    if (!room) return badRequest('Room not found');
    if (!['waiting', 'live'].includes(room.status)) {
      return badRequest('Room is not accepting participants');
    }

    // Check capacity
    const { count } = await sb
      .from('live_room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', id)
      .is('left_at', null);

    if ((count || 0) >= room.max_participants) {
      return badRequest('Room is full');
    }

    // Check not already in room
    const { data: existing } = await sb
      .from('live_room_participants')
      .select('id, left_at')
      .eq('room_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing && !existing.left_at) {
      return badRequest('Already in this room');
    }

    // Re-join or fresh join
    if (existing) {
      const { error: updErr } = await sb
        .from('live_room_participants')
        .update({ left_at: null, role: 'dj', joined_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await sb
        .from('live_room_participants')
        .insert({ room_id: id, user_id: user.id, role: 'dj' });
      if (insErr) throw insErr;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'live-rooms:join');
  }
}
