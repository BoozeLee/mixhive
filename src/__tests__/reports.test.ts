/**
 * @jest-environment node
 */

// Hermetic mocks (defined inside factories — jest hoists jest.mock above imports).
jest.mock('@supabase/supabase-js', () => {
  const getUser = jest.fn();
  const maybeSingle = jest.fn();
  const single = jest.fn();
  const insert = jest.fn(() => ({ select: () => ({ single }) }));
  const makeEqChain = () => {
    const chain: Record<string, unknown> = {};
    chain.eq = jest.fn(() => chain);
    chain.maybeSingle = maybeSingle;
    return chain;
  };
  const createClient = jest.fn((_url: string, key: string) => {
    if (key === 'service-key') {
      return { from: jest.fn(() => ({ select: jest.fn(() => makeEqChain()), insert })) };
    }
    return { auth: { getUser } };
  });
  return { createClient, __mocks: { getUser, maybeSingle, single, insert } };
});

jest.mock('@/lib/redis', () => ({
  redisCache: {
    incrementRateLimit: jest.fn(async () => ({ current: 1, limit: 10, remaining: 9, reset: 0 })),
  },
}));

import { POST } from '@/app/api/reports/route';
import { NextRequest } from 'next/server';
import * as supa from '@supabase/supabase-js';

const { getUser, maybeSingle, single } = (
  supa as unknown as { __mocks: { getUser: jest.Mock; maybeSingle: jest.Mock; single: jest.Mock } }
).__mocks;

function makeReq(body: unknown, withAuth = true) {
  return new NextRequest('https://x.test/api/reports', {
    method: 'POST',
    headers: withAuth
      ? { authorization: 'Bearer token', 'content-type': 'application/json' }
      : { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

beforeEach(() => {
  getUser.mockReset();
  maybeSingle.mockReset();
  single.mockReset();
});

describe('POST /api/reports', () => {
  it('401s without an auth header', async () => {
    const res = await POST(makeReq({ source_table: 'mixes', source_id: 'm1' }, false));
    expect(res.status).toBe(401);
  });

  it('400s on an unsupported source_table', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await POST(makeReq({ source_table: 'secrets', source_id: 'x1' }));
    expect(res.status).toBe(400);
  });

  it('files a report (201) on valid input', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: null }); // no existing open report
    single.mockResolvedValue({ data: { id: 'sig1' }, error: null });

    const res = await POST(makeReq({ source_table: 'mixes', source_id: 'm1', reason: 'spam' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.id).toBe('sig1');
  });

  it('dedupes an existing open report (200, no insert)', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: 'existing' } });

    const res = await POST(makeReq({ source_table: 'mixes', source_id: 'm1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deduped).toBe(true);
    expect(single).not.toHaveBeenCalled();
  });
});
