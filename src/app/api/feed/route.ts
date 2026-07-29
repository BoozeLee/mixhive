import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';
import { rateLimiter } from '@/lib/rateLimiter';

export const runtime = 'nodejs';

function makeSupabase(jwt?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
  return createClient(url, anon, {
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined,
    auth: { persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const rateCheck = await rateLimiter.checkApiLimit('feed');
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'trending';
  const genre = searchParams.get('genre') ?? 'all';
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50);
  const cursorParam = searchParams.get('cursor') ?? null;

  try {
    if (type === 'trending') {
      return await handleTrending(genre, limit, cursorParam);
    }
    if (type === 'following') {
      const userId = searchParams.get('userId');
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      const jwt = req.headers.get('authorization')?.replace('Bearer ', '') ?? undefined;
      return await handleFollowing(userId, limit, jwt);
    }
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err) {
    console.error('[api/feed] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleTrending(genre: string, limit: number, cursorParam: string | null) {
  // Redis L1 — only on first page (no cursor)
  if (!cursorParam) {
    try {
      const cached = await redisCache.getTrendingCache(genre);
      if (cached) {
        return NextResponse.json({
          items: cached.data,
          cursor: cached.cursor,
          hasMore: !!cached.cursor,
          cacheHit: true,
        });
      }
    } catch {
      // Redis unavailable — fall through
    }
  }

  const sb = makeSupabase();
  const cursor = cursorParam ? JSON.parse(cursorParam) : null;
  const { data } = await sb.rpc('get_trending_cursor', {
    p_limit: limit,
    p_cursor_score: cursor?.score ?? null,
    p_cursor_id: cursor?.id ?? null,
  });
  const rows = data ?? [];
  const last = rows[rows.length - 1];
  const nextCursor = rows.length === limit && last ? { score: last.score ?? 0, id: last.id } : null;

  // Populate Redis cache on first page
  if (!cursorParam) {
    try {
      await redisCache.setTrendingCache(
        genre,
        rows,
        nextCursor ? JSON.stringify(nextCursor) : null
      );
    } catch {
      // fail-open
    }
  }

  return NextResponse.json({
    items: rows,
    cursor: nextCursor ? JSON.stringify(nextCursor) : null,
    hasMore: !!nextCursor,
    cacheHit: false,
  });
}

async function handleFollowing(userId: string, limit: number, jwt: string | undefined) {
  // Redis L1 — first page only
  try {
    const cached = await redisCache.getFeedCache(userId);
    if (cached) {
      return NextResponse.json({
        items: cached.data,
        cursor: cached.cursor,
        hasMore: !!cached.cursor,
        cacheHit: true,
      });
    }
  } catch {
    // Redis unavailable — fall through
  }

  const sb = makeSupabase(jwt);

  // Verify JWT if provided
  if (jwt) {
    const {
      data: { user },
      error,
    } = await sb.auth.getUser();
    if (error || !user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Parallel fetch: mixes + buzz feed + own buzzes (first page)
  const [mixRpc, buzzFeed, ownBuzzes] = await Promise.all([
    sb.rpc('get_feed_cursor', {
      p_user_id: userId,
      p_limit: limit,
      p_cursor_created_at: null,
      p_cursor_id: null,
    }),
    sb
      .from('feed_events')
      .select('id, buzz_id, buzzes(*, profiles!buzzes_author_id_fkey(*))')
      .eq('target_id', userId)
      .eq('type', 'buzz')
      .order('created_at', { ascending: false })
      .limit(limit),
    sb
      .from('buzzes')
      .select('*, profiles!buzzes_author_id_fkey(*)')
      .eq('author_id', userId)
      .is('parent_buzz_id', null)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const mixes = (mixRpc.data ?? []).map((m: Record<string, unknown>) => ({
    type: 'mix' as const,
    data: m,
    _ts: m['created_at'],
  }));

  const seenBuzzIds = new Set<string>();
  const buzzRows = (buzzFeed.data ?? [])
    .filter((r: Record<string, unknown>) => r['buzzes'])
    .map((r: Record<string, unknown>) => {
      const buzz = r['buzzes'] as Record<string, unknown>;
      seenBuzzIds.add(buzz['id'] as string);
      return { type: 'buzz' as const, data: buzz, _ts: buzz['created_at'] };
    });

  const ownBuzzRows = (ownBuzzes.data ?? [])
    .filter((b: Record<string, unknown>) => !seenBuzzIds.has(b['id'] as string))
    .map((b: Record<string, unknown>) => ({
      type: 'buzz' as const,
      data: { ...b, author: (b as Record<string, unknown>)['profiles'] },
      _ts: b['created_at'],
    }));

  const merged = [...mixes, ...buzzRows, ...ownBuzzRows]
    .sort((a, b) => (String(a._ts) < String(b._ts) ? 1 : -1))
    .slice(0, limit)
    .map(({ type, data }) => ({ type, data }));

  const mixRows = mixRpc.data ?? [];
  const lastMix = mixRows[mixRows.length - 1] as Record<string, unknown> | undefined;
  const mixCursor =
    mixRows.length === limit && lastMix
      ? JSON.stringify({ created_at: lastMix['created_at'], id: lastMix['id'] })
      : null;

  // Populate Redis
  try {
    await redisCache.setFeedCache(userId, {
      data: merged,
      cursor: mixCursor,
      timestamp: Date.now(),
    });
  } catch {
    // fail-open
  }

  return NextResponse.json({
    items: merged,
    cursor: mixCursor,
    hasMore: !!mixCursor,
    cacheHit: false,
  });
}
