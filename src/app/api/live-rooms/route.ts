import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { handleApiError, unauthorized, badRequest } from '@/lib/api-errors';

const CreateRoomSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  scene_id: z.string().uuid().optional(),
  max_participants: z.number().int().min(2).max(64).optional(),
  is_public: z.boolean().optional(),
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
    const status = searchParams.get('status');

    let query = sb
      .from('live_rooms')
      .select('*, host:profiles!live_rooms_host_id_fkey(id, username, display_name, avatar_url)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ['waiting', 'live', 'ended'].includes(status)) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['waiting', 'live']);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Attach participant count for each room
    const roomIds = (data || []).map((r: { id: string }) => r.id);
    const participantCounts: Record<string, number> = {};
    if (roomIds.length > 0) {
      const { data: counts } = await sb
        .from('live_room_participants')
        .select('room_id')
        .in('room_id', roomIds)
        .is('left_at', null);
      if (counts) {
        for (const row of counts as { room_id: string }[]) {
          participantCounts[row.room_id] = (participantCounts[row.room_id] || 0) + 1;
        }
      }
    }

    const rooms = (data || []).map((room: Record<string, unknown>) => ({
      ...room,
      participant_count: participantCounts[room.id as string] || 0,
    }));

    return NextResponse.json({ rooms, total: count || 0, limit, offset });
  } catch (err) {
    return handleApiError(err, 'live-rooms:list');
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
    const parsed = CreateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid room data', parsed.error.flatten().fieldErrors);
    }

    const { data: room, error: insertErr } = await sb
      .from('live_rooms')
      .insert({
        host_id: user.id,
        title: parsed.data.title || 'Untitled Session',
        description: parsed.data.description || null,
        scene_id: parsed.data.scene_id || null,
        max_participants: parsed.data.max_participants || 8,
        is_public: parsed.data.is_public ?? true,
        status: 'waiting',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Auto-join the host as host participant
    await sb.from('live_room_participants').insert({
      room_id: room.id,
      user_id: user.id,
      role: 'host',
    });

    return NextResponse.json(room, { status: 201 });
  } catch (err) {
    return handleApiError(err, 'live-rooms:create');
  }
}
