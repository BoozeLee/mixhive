import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { handleApiError, unauthorized, badRequest } from '@/lib/api-errors';

const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  scene_id: z.string().uuid().optional(),
  venue_name: z.string().max(200).optional(),
  venue_address: z.string().max(500).optional(),
  cover_image_url: z.string().url().optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional(),
  max_attendees: z.number().int().positive().optional(),
  is_free: z.boolean().optional(),
  ticket_url: z.string().url().optional(),
  status: z.enum(['draft', 'published']).optional(),
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

export async function GET(req: NextRequest) {
  try {
    const sb = makeClient();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sceneId = searchParams.get('scene_id');
    const upcoming = searchParams.get('upcoming');

    let query = sb
      .from('events')
      .select(
        '*, organizer:profiles!events_organizer_id_fkey(id, username, display_name, avatar_url)',
        { count: 'exact' }
      )
      .eq('status', 'published')
      .order('starts_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (sceneId) {
      query = query.eq('scene_id', sceneId);
    }
    if (upcoming === 'true') {
      query = query.gte('starts_at', new Date().toISOString());
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Attach RSVP counts
    const eventIds = (data || []).map((e: { id: string }) => e.id);
    const rsvpCounts: Record<string, { going: number; maybe: number }> = {};
    if (eventIds.length > 0) {
      const { data: rsvps } = await sb
        .from('event_rsvps')
        .select('event_id, status')
        .in('event_id', eventIds)
        .neq('status', 'cancelled');
      if (rsvps) {
        for (const row of rsvps as { event_id: string; status: string }[]) {
          if (!rsvpCounts[row.event_id]) rsvpCounts[row.event_id] = { going: 0, maybe: 0 };
          if (row.status === 'going') rsvpCounts[row.event_id].going++;
          else if (row.status === 'maybe') rsvpCounts[row.event_id].maybe++;
        }
      }
    }

    const events = (data || []).map((event: Record<string, unknown>) => ({
      ...event,
      rsvp_counts: rsvpCounts[event.id as string] || { going: 0, maybe: 0 },
    }));

    return NextResponse.json({ events, total: count || 0, limit, offset });
  } catch (err) {
    return handleApiError(err, 'events:list');
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return unauthorized();
    const jwt = authHeader.slice(7);

    const sb = makeClient(jwt);
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) return unauthorized();

    const body = await req.json();
    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid event data', parsed.error.flatten().fieldErrors);
    }

    const { data: event, error: insErr } = await sb
      .from('events')
      .insert({
        organizer_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        scene_id: parsed.data.scene_id || null,
        venue_name: parsed.data.venue_name || null,
        venue_address: parsed.data.venue_address || null,
        cover_image_url: parsed.data.cover_image_url || null,
        starts_at: parsed.data.starts_at,
        ends_at: parsed.data.ends_at || null,
        max_attendees: parsed.data.max_attendees || null,
        is_free: parsed.data.is_free ?? true,
        ticket_url: parsed.data.ticket_url || null,
        status: parsed.data.status || 'draft',
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Auto-RSVP organizer as going
    await sb.from('event_rsvps').insert({
      event_id: event.id,
      user_id: user.id,
      status: 'going',
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    return handleApiError(err, 'events:create');
  }
}
