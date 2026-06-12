import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Publish a finished Beehive Studio track straight into MixHive as a real `mixes`
// row. Authed by the user's Supabase JWT (same auth.users across both products),
// so `dj_id` is always derived from the verified session — never trusted from the
// client. Uploads the audio to the public `mix-audio` bucket under `${uid}/...`.
const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB

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

    const form = await req.formData();
    const audio = form.get('audio');
    const metaRaw = form.get('metadata');

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio file required' }, { status: 400 });
    }
    let meta: Record<string, unknown> = {};
    if (typeof metaRaw === 'string' && metaRaw.length) {
      try {
        meta = JSON.parse(metaRaw);
      } catch {
        return NextResponse.json({ error: 'invalid metadata json' }, { status: 400 });
      }
    }
    const title = String(meta.title ?? '').trim();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    if (audio.size === 0) return NextResponse.json({ error: 'empty audio file' }, { status: 400 });
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'audio file too large' }, { status: 413 });
    }
    const contentType = audio.type || 'audio/wav';
    if (audio.type && !audio.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'audio content-type required' }, { status: 400 });
    }

    const ext =
      (audio.name?.split('.').pop() || 'wav').toLowerCase().replace(/[^a-z0-9]/g, '') || 'wav';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage
      .from('mix-audio')
      .upload(path, audio, { contentType, upsert: false });
    if (upErr) {
      return NextResponse.json({ error: `upload failed: ${upErr.message}` }, { status: 500 });
    }
    const {
      data: { publicUrl },
    } = sb.storage.from('mix-audio').getPublicUrl(path);

    let genreId: number | null = null;
    if (typeof meta.genre === 'string' && meta.genre.trim()) {
      const { data: g } = await sb
        .from('genres')
        .select('id')
        .ilike('name', meta.genre.trim())
        .limit(1)
        .maybeSingle();
      genreId = (g?.id as number | undefined) ?? null;
    }

    const durationSecs = Number(meta.durationSecs);
    const row = {
      dj_id: user.id,
      title,
      description: typeof meta.description === 'string' ? meta.description : null,
      audio_url: publicUrl,
      duration_seconds: Number.isFinite(durationSecs) ? Math.round(durationSecs) : null,
      genre_id: genreId,
      tags: Array.isArray(meta.tags) ? meta.tags : null,
      platform_links: {
        source: 'beehive-studio',
        bpm: meta.bpm ?? null,
        key: meta.key ?? null,
      },
      is_explicit: false,
    };

    const { data: mix, error: insErr } = await sb.from('mixes').insert(row).select('id').single();
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ id: mix.id, audio_url: publicUrl, url: `/mix/${mix.id}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
