import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

// POST /api/composer/suggest
// Auth required. Returns up to k vector-similar mixes for the Hive Composer.
// Wraps find_mixes_for_set_context RPC with BPM range filtering.

interface SuggestBody {
  mix_id: string;
  bpm_min?: number;
  bpm_max?: number;
  k?: number;
  genre_hint?: string;
}

interface SuggestionRow {
  mix_id: string;
  title: string;
  artist: string;
  similarity: number;
  bpm: number | null;
  camelot: string | null;
  genre: string | null;
}

export async function POST(req: Request) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as SuggestBody;
    const { mix_id, bpm_min = 0, bpm_max = 999, k = 3, genre_hint } = body;

    if (!mix_id) {
      return NextResponse.json({ error: 'mix_id required' }, { status: 400 });
    }

    // Fetch the embedding for this mix
    const { data: embRow, error: embErr } = await supabase
      .from('ai_embeddings')
      .select('embedding')
      .eq('entity_type', 'mix')
      .eq('entity_id', mix_id)
      .single();

    if (embErr || !embRow) {
      return NextResponse.json({ suggestions: [] });
    }

    const { data: rows, error: rpcErr } = await supabase.rpc('find_mixes_for_set_context', {
      p_embedding: embRow.embedding,
      p_bpm_min: bpm_min,
      p_bpm_max: bpm_max,
      p_k: Math.min(k, 20),
      p_genre_hint: genre_hint ?? null,
    });

    if (rpcErr) throw rpcErr;

    const suggestions = ((rows ?? []) as SuggestionRow[]).map(r => ({
      mix_id: r.mix_id,
      title: r.title,
      artist: r.artist,
      similarity: r.similarity,
      bpm: r.bpm ?? null,
      key_camelot: r.camelot ?? null,
      genre: r.genre ?? null,
    }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    return handleApiError(err);
  }
}
