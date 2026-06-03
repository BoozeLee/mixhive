import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const discipline = searchParams.get('discipline');
    const freeOnly = searchParams.get('free') === 'true';
    const minRating = searchParams.get('min_rating');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const sb = makeClient();
    const { data, error } = await sb.rpc('list_agent_packages', {
      p_category: category || null,
      p_discipline: discipline || null,
      p_free_only: freeOnly,
      p_min_rating: minRating ? parseFloat(minRating) : null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;
    return NextResponse.json({ packages: data ?? [], limit, offset });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
