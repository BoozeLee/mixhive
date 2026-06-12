import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ritualAuth, ritualRateLimit } from '../../_lib';

const MessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  channel: z.enum(['audience', 'creators']).default('audience'),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!(await ritualRateLimit(ctx.user.id, 'message', 20, 60))) {
    return NextResponse.json({ error: 'Chat rate limit exceeded' }, { status: 429 });
  }
  const parsed = MessageSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  const { id } = await params;
  const { data: audience } = await ctx.sb
    .from('collab_session_audience')
    .select('status')
    .eq('session_id', id)
    .eq('profile_id', ctx.user.id)
    .maybeSingle();
  if (audience?.status === 'muted' || audience?.status === 'removed') {
    return NextResponse.json({ error: 'You cannot chat in this ritual' }, { status: 403 });
  }

  if (parsed.data.channel === 'creators') {
    const { data: allowed } = await ctx.sb.rpc('can_manage_collab_session', { p_session_id: id });
    if (!allowed)
      return NextResponse.json({ error: 'Creator channel is private' }, { status: 403 });
  }

  const { data, error } = await ctx.sb
    .from('collab_session_messages')
    .insert({
      session_id: id,
      sender_id: ctx.user.id,
      body: parsed.data.body,
      channel: parsed.data.channel,
    })
    .select('*,profiles!collab_session_messages_sender_id_fkey(username,display_name,avatar_url)')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await ctx.sb.from('collab_session_events').insert({
    session_id: id,
    actor_id: ctx.user.id,
    event_type: 'message_sent',
    payload: { channel: parsed.data.channel },
  });
  return NextResponse.json({ message: data }, { status: 201 });
}
