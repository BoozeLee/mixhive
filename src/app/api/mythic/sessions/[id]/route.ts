import { NextRequest, NextResponse } from 'next/server';
import { ritualAuth } from '../_lib';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const { data: session, error } = await ctx.sb
    .from('collab_sessions')
    .select('id,title,description,owner_id,status,is_public')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const [{ data: participant }, { data: audience }, assets, state, messages, votes, events] =
    await Promise.all([
      ctx.sb
        .from('collab_session_participants')
        .select('role')
        .eq('session_id', id)
        .eq('profile_id', ctx.user.id)
        .maybeSingle(),
      ctx.sb
        .from('collab_session_audience')
        .select('status')
        .eq('session_id', id)
        .eq('profile_id', ctx.user.id)
        .maybeSingle(),
      ctx.sb.from('collab_session_assets').select('*').eq('session_id', id).order('created_at'),
      ctx.sb.from('collab_session_state').select('*').eq('session_id', id).maybeSingle(),
      ctx.sb
        .from('collab_session_messages')
        .select(
          '*,profiles!collab_session_messages_sender_id_fkey(username,display_name,avatar_url)'
        )
        .eq('session_id', id)
        .eq('moderation_status', 'visible')
        .order('created_at')
        .limit(100),
      ctx.sb
        .from('collab_session_votes')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      ctx.sb
        .from('collab_session_events')
        .select('*')
        .eq('session_id', id)
        .order('created_at')
        .limit(250),
    ]);

  if (!session.is_public && session.owner_id !== ctx.user.id && !participant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (audience?.status === 'removed') {
    return NextResponse.json({ error: 'You were removed from this ritual' }, { status: 403 });
  }

  const role =
    session.owner_id === ctx.user.id
      ? 'owner'
      : participant?.role === 'moderator'
        ? 'moderator'
        : participant
          ? 'creator'
          : 'audience';

  if (role === 'audience' && !audience && session.status === 'active') {
    const { error: joinError } = await ctx.sb.rpc('join_public_collab_session', {
      p_session_id: id,
    });
    if (joinError) return NextResponse.json({ error: joinError.message }, { status: 403 });
  }

  const fallbackState = {
    session_id: id,
    current_asset_id: null,
    playback_status: 'paused',
    anchor_position: 0,
    anchor_timestamp: new Date().toISOString(),
    revision: 0,
    agent_enabled: true,
    agent_budget_remaining: 5,
  };

  return NextResponse.json({
    session,
    role,
    assets: assets.data ?? [],
    state: state.data ?? fallbackState,
    messages: messages.data ?? [],
    votes: (votes.data ?? []).map(vote => ({
      ...vote,
      options: Array.isArray(vote.options) ? vote.options : [],
    })),
    events: events.data ?? [],
  });
}
