import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: mix } = await sb.from('mixes').select('dj_id').eq('id', params.id).single();
    if (!mix) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (mix.dj_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { scheduled_at } = await req.json();
    if (!scheduled_at) {
      return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 });
    }

    await sb.from('mixes').update({ scheduled_at, published: false }).eq('id', params.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: mix } = await sb.from('mixes').select('dj_id').eq('id', params.id).single();
    if (!mix) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (mix.dj_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await sb.from('mixes').update({ scheduled_at: null }).eq('id', params.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return handleApiError(e); }
}
