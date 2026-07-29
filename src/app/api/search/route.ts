import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimiter } from '@/lib/rateLimiter';

const SearchRequestSchema = z.object({
  q: z.string().trim().min(2).max(100),
  type: z.enum(['all', 'mixes', 'profiles', 'scenes']).default('all'),
  genre: z.string().trim().max(80).optional(),
  location: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

type RankedRow = { item: Record<string, unknown>; relevance: number; total_count: number };

function emptySection() {
  return { items: [] as Record<string, unknown>[], total: 0, hasMore: false };
}

export async function GET(req: NextRequest) {
  const rateCheck = await rateLimiter.checkApiLimit('search');
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const parsed = SearchRequestSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Enter a search query between 2 and 100 characters.' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Search is not configured.' }, { status: 500 });
  }

  const { q, type, genre, location, limit, offset } = parsed.data;
  const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const sections = {
    mixes: emptySection(),
    profiles: emptySection(),
    scenes: emptySection(),
  };

  try {
    const requested = type === 'all' ? (['scenes', 'profiles', 'mixes'] as const) : [type];
    const results = await Promise.all(
      requested.map(async entity => {
        const rpcName = `search_ranked_${entity}` as
          | 'search_ranked_mixes'
          | 'search_ranked_profiles'
          | 'search_ranked_scenes';
        const sectionLimit = type === 'all' ? Math.min(limit, 4) : limit;
        const { data, error } = await sb.rpc(rpcName, {
          p_query: q,
          p_genre: genre || null,
          p_location: location || null,
          p_limit: sectionLimit,
          p_offset: type === 'all' ? 0 : offset,
        });
        if (error) throw error;
        return [entity, (data || []) as RankedRow[], sectionLimit] as const;
      })
    );

    for (const [entity, rows, sectionLimit] of results) {
      const total = Number(rows[0]?.total_count || 0);
      sections[entity] = {
        items: rows.map(row => ({ ...row.item, relevance: row.relevance })),
        total,
        hasMore: (type === 'all' ? sectionLimit : offset + sectionLimit) < total,
      };
    }

    return NextResponse.json({ query: q, type, filters: { genre, location }, sections });
  } catch (error) {
    console.error('[api/search] error:', error);
    return NextResponse.json({ error: 'Search is temporarily unavailable.' }, { status: 500 });
  }
}
