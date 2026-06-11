/**
 * @jest-environment node
 */

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/redis', () => ({
  redisCache: {
    getNotificationsCache: jest.fn(),
    setNotificationsCache: jest.fn(),
    invalidateUserCache: jest.fn(),
  },
}));

import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';
import { GET } from '@/app/api/notifications/route';
import { POST } from '@/app/api/notifications/mark-read/route';
import { NextRequest } from 'next/server';

const mockedCreateClient = createClient as jest.Mock;
const mockCache = redisCache as {
  getNotificationsCache: jest.Mock;
  setNotificationsCache: jest.Mock;
  invalidateUserCache: jest.Mock;
};

const USER_ID = 'user-abc';
const ACCESS_TOKEN = 'token-xyz';

function authHeader() {
  return { Authorization: `Bearer ${ACCESS_TOKEN}` };
}

// Returns a chainable mock query builder that resolves to `result` when awaited.
// Works for both SELECT (ends with .limit()) and UPDATE (ends with .eq(), chain is thenable).
function makeChain(result: unknown = { data: [], error: null }) {
  const leaf = Promise.resolve(result);
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(leaf);
  // Make the chain itself awaitable (for UPDATE which has no terminal .limit())
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    leaf.then(resolve, reject);
  chain.catch = (reject: (e: unknown) => unknown) => leaf.catch(reject);
  return chain;
}

function mockSupabase(opts: { userId?: string; rows?: unknown[]; updateError?: unknown } = {}) {
  const { userId = USER_ID, rows = [], updateError = null } = opts;
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
    from: jest.fn().mockReturnValue(makeChain({ data: rows, error: updateError })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  mockCache.getNotificationsCache.mockResolvedValue(null);
  mockCache.setNotificationsCache.mockResolvedValue(undefined);
  mockCache.invalidateUserCache.mockResolvedValue(undefined);
  mockedCreateClient.mockReturnValue(mockSupabase());
});

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

describe('GET /api/notifications', () => {
  it('returns 401 when auth header is absent', async () => {
    const req = new NextRequest(`http://localhost/api/notifications?userId=${USER_ID}`);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns cached data on Redis hit without querying Supabase', async () => {
    const cached = [{ id: 'n1', read: false }];
    mockCache.getNotificationsCache.mockResolvedValue(cached);
    const req = new NextRequest(`http://localhost/api/notifications?userId=${USER_ID}`, {
      headers: authHeader(),
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.notifications).toEqual(cached);
    // Cache was already fresh — should not be re-written
    expect(mockCache.setNotificationsCache).not.toHaveBeenCalled();
  });

  it('queries Supabase on cache miss and populates Redis', async () => {
    const rows = [{ id: 'n1', actor_id: 'a1', profiles: { id: 'a1', username: 'dj' } }];
    mockedCreateClient.mockReturnValue(mockSupabase({ rows }));
    const req = new NextRequest(`http://localhost/api/notifications?userId=${USER_ID}`, {
      headers: authHeader(),
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(body.notifications).toHaveLength(1);
    expect(mockCache.setNotificationsCache).toHaveBeenCalledWith(USER_ID, expect.any(Array));
  });

  it('returns 403 when userId in query does not match authenticated user', async () => {
    const req = new NextRequest('http://localhost/api/notifications?userId=other-user', {
      headers: authHeader(),
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/mark-read
// ---------------------------------------------------------------------------

describe('POST /api/notifications/mark-read', () => {
  function postMarkRead(body: unknown, includeAuth = true) {
    return POST(
      new NextRequest('http://localhost/api/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          ...(includeAuth ? authHeader() : {}),
        },
      })
    );
  }

  it('returns 401 when auth header is absent', async () => {
    const res = await postMarkRead({ userId: USER_ID }, false);
    expect(res.status).toBe(401);
  });

  it('returns 400 when userId is missing from request body', async () => {
    const res = await postMarkRead({});
    expect(res.status).toBe(400);
  });

  it('updates notifications and invalidates Redis cache', async () => {
    const res = await postMarkRead({ userId: USER_ID });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(USER_ID);
  });
});
