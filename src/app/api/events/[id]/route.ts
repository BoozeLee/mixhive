import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { handleApiError, unauthorized, notFound, forbidden, badRequest } from '@/lib/api-errors';

// Mirrors CreateEventSchema in ../route.ts, but every field is optional since a
// PATCH is a partial update. `status` additionally allows 'cancelled' — the
// DELETE handler below reaches the same state by a different route.
//
// Without this the handler wrote any non-undefined value straight through to the
// DB, so a bad status surfaced as a Postgres CHECK violation rather than a 400.
const UpdateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  scene_id: z.string().uuid().nullable().optional(),
  venue_name: z.string().max(200).nullable().optional(),
  venue_address: z.string().max(500).nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  max_attendees: z.number().int().positive().nullable().optional(),
  is_free: z.boolean().optional(),
  ticket_url: z.string().url().nullable().optional(),
  status: z.enum(['draft', 'published', 'cancelled']).optional(),
});

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
    const parsed = UpdateEventSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid event data', parsed.error.flatten().fieldErrors);
    }

    // safeParse strips unknown keys, so the parsed object is already the
    // allow-list; only drop the keys the caller omitted entirely.
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updates[key] = value;
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
