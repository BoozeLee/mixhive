import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('press_kits')
    .select('*')
    .eq('public_slug', slug)
    .eq('is_public', true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Press kit not found' }, { status: 404 });
  }

  await sb.rpc('increment_press_kit_view_count', { p_slug: slug }).catch(() => undefined);
  return NextResponse.json({ press_kit: data });
}
