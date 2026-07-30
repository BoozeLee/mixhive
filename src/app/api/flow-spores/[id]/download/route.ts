import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const sb = createServerClient();
    const now = new Date().toISOString();

    // Single-use: the conditional update is the guard. Same semantics as the
    // proven ritual handoff route — the pipe is one-shot, but the jar is not.
    const { data: grant } = await sb
      .from('flow_spore_grants')
      .update({ used_at: now })
      .eq('spore_id', id)
      .eq('token_hash', createHash('sha256').update(token).digest('hex'))
      .is('used_at', null)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .select('id')
      .maybeSingle();

    if (!grant) {
      return NextResponse.json(
        { error: 'Grant expired, revoked, or already used' },
        { status: 410 }
      );
    }

    const { data: spore } = await sb
      .from('flow_spores')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle();
    if (!spore?.storage_path) {
      return NextResponse.json({ error: 'Spore document missing' }, { status: 404 });
    }

    const { data: file, error } = await sb.storage
      .from('flow-spores')
      .download(spore.storage_path as string);
    if (error || !file) {
      return NextResponse.json({ error: 'Spore document unreadable' }, { status: 500 });
    }

    return new NextResponse(await file.text(), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error, 'flow-spore:download');
  }
}
