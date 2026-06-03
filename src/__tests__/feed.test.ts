/**
 * @jest-environment node
 */

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/redis', () => ({
  redisCache: {
    getTrendingCache: jest.fn(),
    setTrendingCache: jest.fn(),
    getFeedCache: jest.fn(),
    setFeedCache: jest.fn(),
  },
}));

import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';
import { GET } from '@/app/api/feed/route';
import { NextRequest } from 'next/server';

const mockedCreateClient = createClient as jest.Mock;
const mockCache = redisCache as {
  getTrendingCache: jest.Mock;
  setTrendingCache: jest.Mock;
  getFeedCache: jest.Mock;
  setFeedCache: jest.Mock;
};

// Chainable query builder that resolves to `result` when awaited directly
// (UPDATE scenario) or when .limit() is called (SELECT scenario).
function makeChain(data: unknown[] = []) {
  const leaf = Promise.resolve({ data, error: null });
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.is = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(leaf);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    leaf.then(resolve, reject);
  chain.catch = (reject: (e: unknown) => unknown) => leaf.catch(reject);
  return chain;
}

function mockSupabase(rpcData: unknown[] = [], fromData: unknown[] = []) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: jest.fn().mockReturnValue(makeChain(fromData)),
    rpc: jest.fn().mockResolvedValue({ data: rpcData }),
  };
}

function get(params: Record<string, string>) {
  const url = new URL('http://localhost/api/feed');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return GET(new NextRequest(url.toString()));
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  mockCache.getTrendingCache.mockResolvedValue(null);
  mockCache.setTrendingCache.mockResolvedValue(undefined);
  mockCache.getFeedCache.mockResolvedValue(null);
  mockCache.setFeedCache.mockResolvedValue(undefined);
  mockedCreateClient.mockReturnValue(mockSupabase());
});

// ---------------------------------------------------------------------------
// Trending feed
// ---------------------------------------------------------------------------

describe('GET /api/feed — trending', () => {
  it('returns cached items on Redis hit without creating a Supabase client', async () => {
    const cached = { data: [{ id: 'm1', score: 99 }], cursor: null };
    mockCache.getTrendingCache.mockResolvedValue(cached);
    const res = await get({ type: 'trending' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cacheHit).toBe(true);
    expect(body.items).toEqual(cached.data);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('calls get_trending_cursor RPC on cache miss and stores result', async () => {
    const mixes = [{ id: 'm1', score: 10, created_at: '2026-05-01' }];
    mockedCreateClient.mockReturnValue(mockSupabase(mixes));
    const res = await get({ type: 'trending', genre: 'house' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cacheHit).toBe(false);
    expect(body.items).toHaveLength(1);
    expect(mockCache.setTrendingCache).toHaveBeenCalledWith('house', mixes, null);
  });

  it('uses genre as cache key', async () => {
    await get({ type: 'trending', genre: 'techno' });
    expect(mockCache.getTrendingCache).toHaveBeenCalledWith('techno');
  });

  it('skips cache read and write for paginated requests (cursor present)', async () => {
    const mixes = [{ id: 'm1', score: 10 }];
    mockedCreateClient.mockReturnValue(mockSupabase(mixes));
    await get({ type: 'trending', cursor: JSON.stringify({ score: 5, id: 'prev' }) });
    expect(mockCache.getTrendingCache).not.toHaveBeenCalled();
    expect(mockCache.setTrendingCache).not.toHaveBeenCalled();
  });

  it('returns 400 for an unrecognised type', async () => {
    const res = await get({ type: 'unknown' });
    expect(res.status).toBe(400);
  });

  it('falls back to Supabase when Redis throws (fail-open)', async () => {
    mockCache.getTrendingCache.mockRejectedValue(new Error('Redis down'));
    const mixes = [{ id: 'm1', score: 10 }];
    mockedCreateClient.mockReturnValue(mockSupabase(mixes));
    const res = await get({ type: 'trending' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Following feed
// ---------------------------------------------------------------------------

describe('GET /api/feed — following', () => {
  it('returns 400 when userId is missing', async () => {
    const res = await get({ type: 'following' });
    expect(res.status).toBe(400);
  });

  it('returns cached items on Redis hit', async () => {
    const cached = { data: [{ type: 'mix', data: { id: 'm1' } }], cursor: null };
    mockCache.getFeedCache.mockResolvedValue(cached);
    const res = await get({ type: 'following', userId: 'user-1' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cacheHit).toBe(true);
    expect(body.items).toEqual(cached.data);
  });

  it('fetches mixes and buzzes on cache miss and populates Redis', async () => {
    const mixes = [{ id: 'm1', created_at: '2026-05-01T00:00:00Z' }];
    mockedCreateClient.mockReturnValue(mockSupabase(mixes));
    const res = await get({ type: 'following', userId: 'user-1' });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cacheHit).toBe(false);
    expect(mockCache.setFeedCache).toHaveBeenCalledWith('user-1', expect.any(Object));
  });

  it('caps the limit at 50 regardless of the query param', async () => {
    const sb = mockSupabase();
    mockedCreateClient.mockReturnValue(sb);
    await get({ type: 'following', userId: 'user-1', limit: '100' });
    expect(sb.rpc).toHaveBeenCalledWith(
      'get_feed_cursor',
      expect.objectContaining({ p_limit: 50 })
    );
  });
});
