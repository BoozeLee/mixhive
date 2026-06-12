import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const sb = makeClient();
    const { data, error } = await sb
      .from('hive_story_issues')
      .select('id, slug, title, subtitle, theme_color, hero_image_url, published_at')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(24);

    if (error) throw error;
    return NextResponse.json({ issues: data ?? [] });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : ((err as { message?: string }).message ?? 'Unknown error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
