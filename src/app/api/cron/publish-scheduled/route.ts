import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Fetch due scheduled mixes using the new visibility column.
  // Falls back to the legacy published=false pattern for rows not yet migrated.
  const { data: mixes, error } = await sb
    .from('mixes')
    .select('id')
    .lte('scheduled_at', new Date().toISOString())
    .or(`visibility.eq.scheduled,published.eq.false`)
    .not('scheduled_at', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const ids = mixes?.map(m => m.id) ?? [];

  if (ids.length === 0) {
    return NextResponse.json({ published: 0 });
  }

  const { error: updateError } = await sb
    .from('mixes')
    .update({ visibility: 'published', published: true, published_at: now, scheduled_at: null })
    .in('id', ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ published: ids.length });
}
