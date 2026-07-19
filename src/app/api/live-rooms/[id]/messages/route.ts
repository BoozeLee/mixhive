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

const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const before = searchParams.get('before');

    const sb = makeClient();

    let query = sb
      .from('live_room_messages')
      .select('*, user:profiles!live_room_messages_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('room_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ messages: (data || []).reverse() });
  } catch (err) {
    return handleApiError(err, 'live-rooms:messages:list');
  }
}

export async function POST(
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

    // Verify user is an active participant
    const { data: participant } = await sb
      .from('live_room_participants')
      .select('id')
      .eq('room_id', id)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    if (!participant) return badRequest('You must join the room before sending messages');

    const body = await req.json();
    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Invalid message', parsed.error.flatten().fieldErrors);
    }

    const { data: message, error: insErr } = await sb
      .from('live_room_messages')
      .insert({
        room_id: id,
        user_id: user.id,
        content: parsed.data.content,
      })
      .select('*, user:profiles!live_room_messages_user_id_fkey(id, username, display_name, avatar_url)')
      .single();

    if (insErr) throw insErr;
    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    return handleApiError(err, 'live-rooms:messages:create');
  }
}
