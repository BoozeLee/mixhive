import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeVoteOptions, ritualAuth, ritualRateLimit } from '../../_lib';

const VoteSchema = z.object({
  action: z.enum(['create', 'respond', 'close']),
  prompt: z.string().trim().min(1).max(300).optional(),
  options: z.array(z.string()).optional(),
  vote_id: z.string().uuid().optional(),
  option: z.string().trim().max(120).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const parsed = VoteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid vote request' }, { status: 400 });
  const { id } = await params;

  if (parsed.data.action === 'respond') {
    if (!parsed.data.vote_id || !parsed.data.option) {
      return NextResponse.json({ error: 'vote_id and option required' }, { status: 400 });
    }
    if (!(await ritualRateLimit(ctx.user.id, 'vote', 20, 60))) {
      return NextResponse.json({ error: 'Vote rate limit exceeded' }, { status: 429 });
    }
    const { data: vote } = await ctx.sb
      .from('collab_session_votes')
      .select('options,status')
      .eq('id', parsed.data.vote_id)
      .eq('session_id', id)
      .maybeSingle();
    const validOptions = normalizeVoteOptions(vote?.options);
    if (!vote || vote.status !== 'open' || !validOptions.includes(parsed.data.option)) {
      return NextResponse.json({ error: 'Vote is closed or option is invalid' }, { status: 409 });
    }
    const { error } = await ctx.sb
      .from('collab_session_vote_responses')
      .upsert(
        { vote_id: parsed.data.vote_id, profile_id: ctx.user.id, option: parsed.data.option },
        { onConflict: 'vote_id,profile_id' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: allowed } = await ctx.sb.rpc('can_manage_collab_session', { p_session_id: id });
  if (!allowed) return NextResponse.json({ error: 'Only creators manage votes' }, { status: 403 });

  if (parsed.data.action === 'close' && parsed.data.vote_id) {
    const { data, error } = await ctx.sb
      .from('collab_session_votes')
      .update({ status: 'closed', selected_option: parsed.data.option ?? null })
      .eq('id', parsed.data.vote_id)
      .eq('session_id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vote: data });
  }

  const options = normalizeVoteOptions(parsed.data.options);
  if (!parsed.data.prompt || options.length < 2) {
    return NextResponse.json(
      { error: 'A prompt and at least two options are required' },
      { status: 400 }
    );
  }
  const { data, error } = await ctx.sb
    .from('collab_session_votes')
    .insert({
      session_id: id,
      created_by: ctx.user.id,
      prompt: parsed.data.prompt,
      options,
      actor_type: 'profile',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vote: data }, { status: 201 });
}
