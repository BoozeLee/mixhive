// Bridge endpoint for Beehive Studio to publish tracks to MixHive.
// Records Beehive provenance and metadata (agent band members, session IDs).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError } from '@/lib/api-errors';

function makeClient(jwt?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    auth: { persistSession: false },
  });
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);
    const sb = makeClient(jwt);

    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const body = await req.json();
    const { title, description, audio_url, artwork_url, genre_id, beehive_metadata } = body;

    if (!title || !audio_url) {
      return NextResponse.json({ error: 'Missing title or audio_url' }, { status: 400 });
    }

    // Insert as a mix with beehive provenance
    const { data: mix, error: mixErr } = await sb
      .from('mixes')
      .insert({
        dj_id: user.id,
        title,
        description,
        audio_url,
        artwork_url,
        genre_id,
        published_from: 'beehive',
        beehive_metadata: beehive_metadata || {},
        published: true,
      })
      .select()
      .single();

    if (mixErr) throw mixErr;

    // Create a feed event
    await sb.from('feed_events').insert({
      actor_id: user.id,
      type: 'mix_upload',
      mix_id: mix.id,
    });

    // Notify followers (optional, handled by triggers usually but we can be explicit)
    // Actually, trigger 002_notification_triggers.sql likely handles mix_upload.

    return NextResponse.json({
      ok: true,
      mix_id: mix.id,
      badge: 'published_from_beehive',
    });
  } catch (err) {
    return handleApiError(err, 'bridge/publish');
  }
}
