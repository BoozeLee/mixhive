import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError, unauthorized, notFound, forbidden } from '@/lib/api-errors';

function makeClient(jwt?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, {
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
    auth: { persistSession: false },
  });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const sb = makeClient();

    const { data: room, error } = await sb
      .from('live_rooms')
      .select('*, host:profiles!live_rooms_host_id_fkey(id, username, display_name, avatar_url)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!room) return notFound('Room not found');

    // Get participants
    const { data: participants } = await sb
      .from('live_room_participants')
      .select('*, user:profiles!live_room_participants_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('room_id', id)
      .is('left_at', null)
      .order('joined_at', { ascending: true });

    return NextResponse.json({
      ...room,
      participants: participants || [],
      participant_count: (participants || []).length,
    });
  } catch (err) {
    return handleApiError(err, 'live-rooms:get');
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return unauthorized();
    const jwt = authHeader.slice(7);

    const sb = makeClient(jwt);
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return unauthorized();

    // Check ownership
    const { data: existing } = await sb
      .from('live_rooms')
      .select('host_id, status')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return notFound('Room not found');
    if (existing.host_id !== user.id) return forbidden('Only the host can update this room');

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.max_participants !== undefined) updates.max_participants = body.max_participants;
    if (body.is_public !== undefined) updates.is_public = body.is_public;

    // Status transitions
    if (body.status === 'live' && existing.status === 'waiting') {
      updates.status = 'live';
      updates.started_at = new Date().toISOString();
    } else if (body.status === 'ended' && existing.status !== 'ended') {
      updates.status = 'ended';
      updates.ended_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: room, error: updateErr } = await sb
      .from('live_rooms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return NextResponse.json(room);
  } catch (err) {
    return handleApiError(err, 'live-rooms:update');
  }
}

export async function DELETE(
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

    const { data: existing } = await sb
      .from('live_rooms')
      .select('host_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return notFound('Room not found');
    if (existing.host_id !== user.id) return forbidden('Only the host can end this room');

    // Set all participants as left
    await sb
      .from('live_room_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('room_id', id)
      .is('left_at', null);

    const { error: delErr } = await sb
      .from('live_rooms')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', id);

    if (delErr) throw delErr;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'live-rooms:end');
  }
}
