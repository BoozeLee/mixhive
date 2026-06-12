import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ritualAuth } from '../../_lib';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const { data: allowed } = await ctx.sb.rpc('can_manage_collab_session', { p_session_id: id });
  if (!allowed)
    return NextResponse.json({ error: 'Only creators can create a handoff' }, { status: 403 });
  const token = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { error } = await ctx.sb.from('collab_session_handoff_tokens').insert({
    session_id: id,
    created_by: ctx.user.id,
    token_hash: tokenHash,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    token,
    deep_link: `beehive://session/${token}`,
    download_url: `/api/mythic/sessions/${id}/handoff?token=${encodeURIComponent(token)}`,
    expires_in_seconds: 600,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });
  const sb = createServerClient();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date().toISOString();
  const { data: row } = await sb
    .from('collab_session_handoff_tokens')
    .update({ used_at: now })
    .eq('session_id', id)
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', now)
    .select('id')
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: 'Handoff token expired or already used' }, { status: 410 });
  }
  const [{ data: session }, { data: assets }, { data: events }] = await Promise.all([
    sb
      .from('collab_sessions')
      .select('id,title,description,owner_id,created_at,ended_at')
      .eq('id', id)
      .single(),
    sb.from('collab_session_assets').select('*').eq('session_id', id).order('created_at'),
    sb
      .from('collab_session_events')
      .select('event_type,payload,created_at')
      .eq('session_id', id)
      .order('created_at'),
  ]);
  const signedAssets = await Promise.all(
    (assets ?? []).map(async asset => {
      const { data } = await sb.storage.from('mix-audio').createSignedUrl(asset.storage_path, 600);
      return { ...asset, signed_url: data?.signedUrl ?? null };
    })
  );
  return NextResponse.json({ version: 1, session, assets: signedAssets, events: events ?? [] });
}
