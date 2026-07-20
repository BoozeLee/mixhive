import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
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

const RsvpSchema = z.object({
  status: z.enum(['going', 'maybe', 'cancelled']),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return unauthorized();
    const jwt = authHeader.slice(7);

    const sb = makeClient(jwt);
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) return unauthorized();

    // Check event exists and is published
    const { data: event } = await sb
      .from('events')
      .select('id, status, max_attendees')
      .eq('id', id)
      .maybeSingle();

    if (!event) return badRequest('Event not found');
    if (event.status !== 'published') return badRequest('Event is not available for RSVP');

    const body = await req.json();
    const parsed = RsvpSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid RSVP data', parsed.error.flatten().fieldErrors);
    }

    // Check capacity for "going"
    if (parsed.data.status === 'going' && event.max_attendees) {
      const { count } = await sb
        .from('event_rsvps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', id)
        .eq('status', 'going');
      if ((count || 0) >= event.max_attendees) {
        return badRequest('Event is at capacity');
      }
    }

    // Upsert RSVP
    const { data: rsvp, error: upsertErr } = await sb
      .from('event_rsvps')
      .upsert(
        { event_id: id, user_id: user.id, status: parsed.data.status },
        { onConflict: 'event_id,user_id' }
      )
      .select()
      .single();

    if (upsertErr) throw upsertErr;
    return NextResponse.json(rsvp);
  } catch (err) {
    return handleApiError(err, 'events:rsvp');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return unauthorized();
    const jwt = authHeader.slice(7);

    const sb = makeClient(jwt);
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) return unauthorized();

    const { error: delErr } = await sb
      .from('event_rsvps')
      .delete()
      .eq('event_id', id)
      .eq('user_id', user.id);

    if (delErr) throw delErr;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'events:cancel-rsvp');
  }
}
