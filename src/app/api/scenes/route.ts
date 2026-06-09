import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public: list active scene community pages. No auth required (RLS allows anon
// select on active scenes; only public-safe columns are returned).
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from('scenes')
      .select('slug,name,city,country,genre,description,hero_image_url')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return NextResponse.json({ scenes: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
