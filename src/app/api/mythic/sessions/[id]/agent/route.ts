import { NextRequest, NextResponse } from 'next/server';
import { ritualAuth } from '../../_lib';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { data: allowed } = await ctx.sb.rpc('can_manage_collab_session', { p_session_id: id });
  if (!allowed)
    return NextResponse.json(
      { error: 'Only creators can invoke the Session Spirit' },
      { status: 403 }
    );

  const { data: state } = await ctx.sb
    .from('collab_session_state')
    .select('*')
    .eq('session_id', id)
    .maybeSingle();
  if (body.action === 'toggle') {
    const { data, error } = await ctx.sb
      .from('collab_session_state')
      .update({ agent_enabled: !state?.agent_enabled, updated_by: ctx.user.id })
      .eq('session_id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ state: data });
  }
  const { data: budgetRemaining, error: claimError } = await ctx.sb.rpc(
    'claim_collab_agent_action',
    { p_session_id: id, p_cooldown_seconds: 120 }
  );
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 409 });

  const [{ data: assets }, { data: messages }] = await Promise.all([
    ctx.sb.from('collab_session_assets').select('id,name').eq('session_id', id).limit(6),
    ctx.sb
      .from('collab_session_messages')
      .select('body')
      .eq('session_id', id)
      .eq('moderation_status', 'visible')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  const options = (assets ?? []).slice(0, 4).map(asset => asset.name);
  const payload =
    options.length >= 2
      ? {
          kind: 'vote',
          message: 'The Session Spirit sensed a fork in the ritual and opened a direction vote.',
          options,
        }
      : {
          kind: 'moment',
          message:
            messages && messages.length > 2
              ? 'The Session Spirit marked this conversation as a creative turning point.'
              : 'The Session Spirit is listening. Add more assets or ideas to shape its next move.',
        };

  if (payload.kind === 'vote' && payload.options) {
    await ctx.sb.from('collab_session_votes').insert({
      session_id: id,
      actor_type: 'agent',
      prompt: 'Which direction should the creators explore next?',
      options: payload.options,
    });
  }
  await ctx.sb.from('collab_session_events').insert({
    session_id: id,
    actor_id: ctx.user.id,
    actor_type: 'agent',
    event_type: `agent_${payload.kind}`,
    payload,
  });
  return NextResponse.json({ action: payload, budget_remaining: budgetRemaining });
}
