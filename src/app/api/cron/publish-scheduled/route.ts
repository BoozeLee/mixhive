import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  const { data: mixes, error } = await sb
    .from('mixes')
    .select('id, dj_id')
    .lte('scheduled_at', new Date().toISOString())
    .eq('published', false)
    .eq('archived', false)
    .not('scheduled_at', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const mix of mixes || []) {
    const { error: updateErr } = await sb
      .from('mixes')
      .update({ published: true, published_at: now, scheduled_at: null })
      .eq('id', mix.id);

    results.push({
      id: mix.id,
      ok: !updateErr,
      error: updateErr?.message,
    });
  }

  return NextResponse.json({ published: results.length, results });
}
