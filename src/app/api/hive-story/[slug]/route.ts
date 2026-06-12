import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const sb = makeClient();

    const { data: issue, error: issueErr } = await sb
      .from('hive_story_issues')
      .select('*')
      .eq('slug', slug)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .single();

    if (issueErr || !issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    const { data: features, error: featuresErr } = await sb
      .from('hive_story_features')
      .select(
        `
        id,
        feature_type,
        headline,
        body_text,
        order_position,
        profile_id,
        mix_id,
        profile:profiles(id, username, display_name, avatar_url, genres),
        mix:mixes(id, title, cover_url, genre)
      `
      )
      .eq('issue_id', issue.id)
      .order('order_position', { ascending: true });

    if (featuresErr) throw featuresErr;

    return NextResponse.json({ issue, features: features ?? [] });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : ((err as { message?: string }).message ?? 'Unknown error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
