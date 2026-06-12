import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ritualAuth } from '../../_lib';

const ModerationSchema = z.object({
  action: z.enum(['mute', 'remove', 'hide_message']),
  profile_id: z.string().uuid().optional(),
  message_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const parsed = ModerationSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid moderation action' }, { status: 400 });
  const { data: allowed } = await ctx.sb.rpc('can_manage_collab_session', { p_session_id: id });
  if (!allowed) return NextResponse.json({ error: 'Only creators can moderate' }, { status: 403 });

  if (parsed.data.action === 'hide_message' && parsed.data.message_id) {
    const { error } = await ctx.sb
      .from('collab_session_messages')
      .update({ moderation_status: 'hidden' })
      .eq('id', parsed.data.message_id)
      .eq('session_id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (parsed.data.profile_id) {
    const { error } = await ctx.sb
      .from('collab_session_audience')
      .update({ status: parsed.data.action === 'mute' ? 'muted' : 'removed' })
      .eq('session_id', id)
      .eq('profile_id', parsed.data.profile_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: 'Moderation target required' }, { status: 400 });
  }
  const { error: eventError } = await ctx.sb.from('collab_session_events').insert({
    session_id: id,
    actor_id: ctx.user.id,
    event_type: `moderation_${parsed.data.action}`,
    payload: { profile_id: parsed.data.profile_id, message_id: parsed.data.message_id },
  });
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
