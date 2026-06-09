import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public: a single scene with its ranked artist listings + label/collective
// partners. Backed by the get_scene_listings / get_scene_partners RPCs, which
// return only public-safe fields. No auth required.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    const { data: scene, error: sceneErr } = await sb
      .from('scenes')
      .select('slug,name,city,country,genre,description,hero_image_url')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (sceneErr) throw sceneErr;
    if (!scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });

    const [listingsRes, partnersRes] = await Promise.all([
      sb.rpc('get_scene_listings', { p_slug: slug }),
      sb.rpc('get_scene_partners', { p_slug: slug }),
    ]);

    if (listingsRes.error) throw listingsRes.error;
    if (partnersRes.error) throw partnersRes.error;

    return NextResponse.json({
      scene,
      listings: listingsRes.data || [],
      partners: partnersRes.data || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
