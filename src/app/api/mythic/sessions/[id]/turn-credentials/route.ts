import { NextRequest, NextResponse } from 'next/server';
import { createTurnCredentials, readTurnCredentialConfig } from '@/lib/turnCredentials';
import { ritualAuth, ritualRateLimit } from '../../_lib';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ritualAuth(req);
  if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const { data: allowed } = await ctx.sb.rpc('can_manage_collab_session', { p_session_id: id });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Only active-session creators can use talkback' },
      { status: 403 }
    );
  }
  if (!(await ritualRateLimit(ctx.user.id, `turn:${id}`, 12, 60 * 60))) {
    return NextResponse.json({ error: 'TURN credential rate limit exceeded' }, { status: 429 });
  }

  try {
    return NextResponse.json(createTurnCredentials(ctx.user.id, readTurnCredentialConfig()), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'TURN relay is unavailable' }, { status: 503 });
  }
}
