import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { moderateContent } from '@/lib/moderation';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { title, description, artwork_url, audio_url, duration_seconds, genre_id, tags } =
      await req.json();

    if (!title?.trim() || !audio_url) {
      return NextResponse.json({ error: 'Title and audio_url are required' }, { status: 400 });
    }

    const { data: mix, error } = await sb
      .from('mixes')
      .insert({
        dj_id: user.id,
        title,
        description,
        artwork_url,
        audio_url,
        duration_seconds,
        genre_id,
        tags: tags ?? [],
        upload_status: 'uploaded',
      })
      .select()
      .single();

    if (error) throw error;

    if (description?.trim()) {
      await moderateContent('mixes', mix.id, description);
    }

    return NextResponse.json(mix, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
