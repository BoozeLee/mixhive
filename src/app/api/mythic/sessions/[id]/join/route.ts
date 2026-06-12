import { NextRequest, NextResponse } from 'next/server';
import { ritualAuth } from '../../_lib';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  const { data: status, error } = await ctx.sb.rpc('join_public_collab_session', {
    p_session_id: id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, role: 'audience', status });
}
