import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ritualAuth } from '../../_lib';

const StateSchema = z.object({
  current_asset_id: z.string().uuid().nullable(),
  playback_status: z.enum(['paused', 'playing']),
  anchor_position: z.number().min(0),
  revision: z.number().int().min(0),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const parsed = StateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid playback state' }, { status: 400 });
  const { id } = await params;
  const { data: allowed } = await ctx.sb.rpc('can_manage_collab_session', { p_session_id: id });
  if (!allowed)
    return NextResponse.json({ error: 'Only creators control playback' }, { status: 403 });

  const { data: current } = await ctx.sb
    .from('collab_session_state')
    .select('revision')
    .eq('session_id', id)
    .maybeSingle();
  if (current && Number(current.revision) !== parsed.data.revision) {
    return NextResponse.json(
      { error: 'Playback state changed; refresh and retry' },
      { status: 409 }
    );
  }
  const next = {
    session_id: id,
    current_asset_id: parsed.data.current_asset_id,
    playback_status: parsed.data.playback_status,
    anchor_position: parsed.data.anchor_position,
    anchor_timestamp: new Date().toISOString(),
    revision: parsed.data.revision + 1,
    updated_by: ctx.user.id,
    updated_at: new Date().toISOString(),
  };
  const query = current
    ? ctx.sb
        .from('collab_session_state')
        .update(next)
        .eq('session_id', id)
        .eq('revision', parsed.data.revision)
    : ctx.sb.from('collab_session_state').insert(next);
  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await ctx.sb.from('collab_session_events').insert({
    session_id: id,
    actor_id: ctx.user.id,
    event_type: 'playback_changed',
    payload: next,
  });
  return NextResponse.json({ state: data });
}
