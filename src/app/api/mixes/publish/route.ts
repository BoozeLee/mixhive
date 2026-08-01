import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { slugify } from '@/lib/slug';
import { rateLimiter } from '@/lib/rateLimiter';

// Publish a finished track into MixHive as a real `mixes` row, optionally with
// AI-agent provenance ("AI band" credits). Authed by the user's Supabase JWT, so
// `dj_id` is always derived from the verified session — never trusted from the
// client. Uploads audio to the public `mix-audio` bucket under `${uid}/...`, then
// writes the mix row + credits + `ai_band` flag atomically via an RPC.
const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_AGENTS = 24;

const cap = (v: unknown, n: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, n) : null;
};

const PublishMetadataSchema = z.object({
  title: z.string().trim().min(1, 'title required').max(200),
  description: z.string().max(2000).optional(),
  genre: z.string().max(80).optional(),
  durationSecs: z.number().finite().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  source: z.string().max(100).optional(),
  bpm: z.number().finite().optional(),
  key: z.string().max(10).optional(),
  provenance: z
    .object({
      agents: z
        .array(
          z.object({
            name: z.string().max(80),
            role: z.string().max(60).optional(),
            contribution: z.string().max(280).optional(),
            model: z.string().max(60).optional(),
          })
        )
        .max(MAX_AGENTS)
        .optional(),
    })
    .optional(),
});

// Parse + validate the optional AI-agent provenance into credit rows. Returns []
// when absent/invalid so publishing without provenance behaves exactly as before.
function parseCredits(meta: Record<string, unknown>) {
  const prov = meta.provenance as { agents?: unknown } | undefined;
  const agents = Array.isArray(prov?.agents) ? prov!.agents : [];
  const out: Array<Record<string, string | null>> = [];
  for (const a of agents.slice(0, MAX_AGENTS)) {
    if (!a || typeof a !== 'object') continue;
    const rec = a as Record<string, unknown>;
    const name = cap(rec.name, 80);
    if (!name) continue;
    out.push({
      agent_slug: slugify(name),
      agent_name: name,
      agent_role: cap(rec.role, 60),
      contribution: cap(rec.contribution, 280),
      model: cap(rec.model, 60),
    });
  }
  return out;
}

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

    const rateCheck = await rateLimiter.checkUploadLimit(user.id);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Upload rate limit exceeded' }, { status: 429 });
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
    const parsedMeta = PublishMetadataSchema.safeParse(meta);
    if (!parsedMeta.success) {
      return NextResponse.json(
        { error: parsedMeta.error.issues[0]?.message || 'Invalid metadata' },
        { status: 400 }
      );
    }
    const validatedMeta = parsedMeta.data;
    const title = validatedMeta.title;
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
    if (validatedMeta.genre) {
      const { data: g } = await sb
        .from('genres')
        .select('id')
        .ilike('name', validatedMeta.genre)
        .limit(1)
        .maybeSingle();
      genreId = (g?.id as number | undefined) ?? null;
    }

    const durationSecs = validatedMeta.durationSecs ?? 0;
    const credits = parseCredits(meta);
    const pMix = {
      title,
      description: validatedMeta.description ?? null,
      audio_url: publicUrl,
      duration_seconds: Number.isFinite(durationSecs) ? Math.round(durationSecs) : null,
      genre_id: genreId,
      tags: validatedMeta.tags ?? null,
      platform_links: {
        source: validatedMeta.source ?? 'mixhive',
        bpm: validatedMeta.bpm ?? null,
        key: validatedMeta.key ?? null,
      },
      is_explicit: false,
    };

    // One atomic call: mix row + agent credits + ai_band flag (dj_id forced to
    // auth.uid() inside the RPC). No partial state if credits fail.
    const { data: mixId, error: rpcErr } = await sb.rpc('publish_mix_with_credits', {
      p_mix: pMix,
      p_credits: credits,
    });
    if (rpcErr || !mixId) {
      // Roll back the orphaned upload so a failed publish leaves no stray audio.
      await sb.storage
        .from('mix-audio')
        .remove([path])
        .catch(() => {});
      return NextResponse.json({ error: rpcErr?.message || 'publish failed' }, { status: 500 });
    }

    return NextResponse.json({ id: mixId, audio_url: publicUrl, url: `/mix/${mixId}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
