import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { ritualAuth } from '@/app/api/mythic/sessions/_lib';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    // RLS already restricts flow_spores SELECT to the turner and contributors,
    // so an invisible spore reads as not-found rather than forbidden.
    const { data: spore } = await ctx.sb
      .from('flow_spores')
      .select('id, state')
      .eq('id', id)
      .maybeSingle();
    if (!spore) return NextResponse.json({ error: 'Spore not found' }, { status: 404 });
    if (spore.state !== 'sealed') {
      return NextResponse.json({ error: 'Spore is not sealed' }, { status: 409 });
    }

    const token = randomBytes(24).toString('base64url');
    const { error } = await ctx.sb.from('flow_spore_grants').insert({
      spore_id: id,
      issued_by: ctx.user.id,
      rights: ['read'],
      token_hash: createHash('sha256').update(token).digest('hex'),
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      token,
      download_url: `/api/flow-spores/${id}/download?token=${encodeURIComponent(token)}`,
      expires_in_seconds: 600,
    });
  } catch (error) {
    return handleApiError(error, 'flow-spore:grant');
  }
}
