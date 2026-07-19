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

    const { data: event, error } = await sb
      .from('events')
      .select('*, organizer:profiles!events_organizer_id_fkey(id, username, display_name, avatar_url), scene:scenes(id, name)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!event) return notFound('Event not found');

    // Get RSVP counts
    const { data: rsvps } = await sb
      .from('event_rsvps')
      .select('status, user:profiles!event_rsvps_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('event_id', id)
      .neq('status', 'cancelled');

    const going = (rsvps || []).filter((r: { status: string }) => r.status === 'going');
    const maybe = (rsvps || []).filter((r: { status: string }) => r.status === 'maybe');

    return NextResponse.json({
      ...event,
      rsvp_counts: { going: going.length, maybe: maybe.length },
      attendees: going.map((r: { user: unknown }) => r.user),
    });
  } catch (err) {
    return handleApiError(err, 'events:get');
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

    const { data: existing } = await sb
      .from('events')
      .select('organizer_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return notFound('Event not found');
    if (existing.organizer_id !== user.id) return forbidden('Only the organizer can update this event');

    const body = await req.json();
    const allowed = ['title', 'description', 'scene_id', 'venue_name', 'venue_address',
      'cover_image_url', 'starts_at', 'ends_at', 'max_attendees', 'is_free', 'ticket_url', 'status'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: event, error: updErr } = await sb
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw updErr;
    return NextResponse.json(event);
  } catch (err) {
    return handleApiError(err, 'events:update');
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
      .from('events')
      .select('organizer_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return notFound('Event not found');
    if (existing.organizer_id !== user.id) return forbidden('Only the organizer can cancel this event');

    const { error: updErr } = await sb
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updErr) throw updErr;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'events:cancel');
  }
}
