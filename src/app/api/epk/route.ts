import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveAiContext } from '../ai/_lib/auth';

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || `mixhive-${crypto.randomUUID().slice(0, 8)}`;
}

function compactList(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAiContext(req);
  if (!ctx.userId) {
    return NextResponse.json({ error: ctx.error ?? 'Not authenticated' }, { status: 401 });
  }

  const authHeader = req.headers.get('authorization')!;
  const jwt = authHeader.slice(7);
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    }
  );

  const { data, error } = await sb
    .from('press_kits')
    .select('*')
    .eq('owner_id', ctx.userId)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({
        press_kits: [],
        setup_required: true,
        message: 'press_kits migration has not been applied yet.',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ press_kits: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAiContext(req);
  if (!ctx.userId) {
    return NextResponse.json({ error: ctx.error ?? 'Not authenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    publish?: boolean;
    custom_sections?: Array<{ heading: string; body: string }>;
  };
  const authHeader = req.headers.get('authorization')!;
  const jwt = authHeader.slice(7);
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    }
  );

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select(
      'username, display_name, avatar_url, bio, location, website, genres, social_links, dj_equipment, dj_daw, dj_style'
    )
    .eq('id', ctx.userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: profileError?.message ?? 'Profile not found' },
      { status: 404 }
    );
  }

  const { data: mixes } = await sb
    .from('mixes')
    .select('id, title, play_count, like_count, created_at')
    .eq('dj_id', ctx.userId)
    .eq('published', true)
    .order('play_count', { ascending: false })
    .limit(5);

  const artistName = profile.display_name || profile.username || 'MIXHIVE creator';
  const genres = Array.isArray(profile.genres) ? profile.genres : [];
  const pitchParts = compactList([
    `${artistName}${profile.location ? ` is based in ${profile.location}` : ''}.`,
    genres.length ? `Core sound: ${genres.slice(0, 5).join(', ')}.` : null,
    profile.dj_style ? `Performance style: ${profile.dj_style}.` : null,
    mixes?.length
      ? `Featured MIXHIVE catalogue includes ${mixes.length} published mix${mixes.length === 1 ? '' : 'es'}.`
      : null,
  ]);

  const content = {
    artist_name: artistName,
    location: profile.location,
    bio: profile.bio,
    genres,
    website: profile.website,
    social_links: profile.social_links || {},
    avatar_url: profile.avatar_url,
    top_mixes: (mixes || []).map(mix => ({
      id: mix.id,
      title: mix.title,
      play_count: mix.play_count || 0,
      like_count: mix.like_count || 0,
      url_path: `/mix/${mix.id}`,
    })),
    booking_pitch: pitchParts.join(' '),
    technical_notes: compactList([
      Array.isArray(profile.dj_equipment) && profile.dj_equipment.length
        ? `Equipment: ${profile.dj_equipment.join(', ')}`
        : null,
      Array.isArray(profile.dj_daw) && profile.dj_daw.length
        ? `DAW/software: ${profile.dj_daw.join(', ')}`
        : null,
    ]),
    generated_from: ['profile', 'published_mixes', 'social_links'],
    custom_sections: body.custom_sections?.filter(s => s.heading.trim() && s.body.trim()) || [],
  };

  const baseSlug = slugify(profile.username || artistName);
  const publicSlug = `${baseSlug}-epk`;

  const { data: existing, error: existingError } = await sb
    .from('press_kits')
    .select('id, version')
    .eq('owner_id', ctx.userId)
    .eq('public_slug', publicSlug)
    .maybeSingle();

  if (existingError && existingError.code === '42P01') {
    return NextResponse.json(
      {
        error: 'press_kit_storage_not_ready',
        message: 'The press_kits migration must be applied before EPK generation can store drafts.',
      },
      { status: 503 }
    );
  }

  const payload = {
    owner_id: ctx.userId,
    public_slug: publicSlug,
    title: `${artistName} EPK`,
    content,
    is_public: Boolean(body.publish),
    version: existing?.version ? existing.version + 1 : 1,
  };

  const query = existing?.id
    ? sb.from('press_kits').update(payload).eq('id', existing.id).eq('owner_id', ctx.userId)
    : sb.from('press_kits').insert(payload);

  const { data: pressKit, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ press_kit: pressKit });
}
