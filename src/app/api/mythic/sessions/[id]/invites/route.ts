import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ritualAuth } from '../../_lib';

const InviteSchema = z.object({
  profile_id: z.string().uuid(),
  role: z.enum(['creator', 'moderator']).default('creator'),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const parsed = InviteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid invite' }, { status: 400 });
  const { data: allowed } = await ctx.sb.rpc('can_manage_collab_session', { p_session_id: id });
  if (!allowed) return NextResponse.json({ error: 'Only creators can invite' }, { status: 403 });
  const { data, error } = await ctx.sb
    .from('collab_session_invites')
    .upsert(
      {
        session_id: id,
        profile_id: parsed.data.profile_id,
        role: parsed.data.role,
        invited_by: ctx.user.id,
        status: 'pending',
      },
      { onConflict: 'session_id,profile_id' }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite: data }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status === 'accepted' ? 'accepted' : 'declined';
  const { data: invite } = await ctx.sb
    .from('collab_session_invites')
    .select('role,status,expires_at')
    .eq('session_id', id)
    .eq('profile_id', ctx.user.id)
    .maybeSingle();
  if (
    !invite ||
    invite.status !== 'pending' ||
    new Date(invite.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: 'Invite unavailable' }, { status: 404 });
  }
  const { error } = await ctx.sb.rpc('accept_collab_session_invite', {
    p_session_id: id,
    p_accept: status === 'accepted',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
