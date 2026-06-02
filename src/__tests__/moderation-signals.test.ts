/**
 * @jest-environment node
 */

const SERVICE_TOKEN = 'test-service-token';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.SERVICE_ROLE_TOKEN = SERVICE_TOKEN;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { POST, GET } from '../app/api/moderation/signals/route';
import { PATCH } from '../app/api/moderation/signals/[id]/route';

const mockCreateClient = createClient as jest.Mock;

function makeChain(result = { data: null as unknown, error: null as unknown }) {
  const leaf = Promise.resolve(result);
  const chain = {} as Record<string, unknown>;
  for (const m of ['select', 'insert', 'update', 'eq', 'order', 'range', 'single', 'limit']) {
    (chain as Record<string, jest.Mock>)[m] = jest.fn().mockReturnValue(chain);
  }
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => leaf.then(res, rej);
  chain.catch = (rej: (e: unknown) => unknown) => leaf.catch(rej);
  return chain;
}

function makeReq(opts: {
  headers?: Record<string, string>;
  body?: unknown;
  url?: string;
}) {
  return {
    headers: { get: (k: string) => (opts.headers ?? {})[k.toLowerCase()] ?? null },
    json: async () => opts.body ?? {},
    url: opts.url ?? 'http://localhost/api/moderation/signals',
  } as unknown as NextRequest;
}

describe('/api/moderation/signals POST', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without Authorization header', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid severity enum', async () => {
    const chain = makeChain();
    mockCreateClient.mockReturnValue({ from: () => chain });
    const res = await POST(makeReq({
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      body: { source_table: 'buzzes', source_id: 'uuid-1', signal_type: 'hate_speech', severity: 'extreme' },
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid severity/);
  });

  it('returns 201 on valid signal creation', async () => {
    const signal = {
      id: 'sig-1', source_table: 'buzzes', source_id: 'uuid-1',
      signal_type: 'hate_speech', severity: 'high',
      flagged_by: 'moderation_agent', payload: {}, created_at: new Date().toISOString(),
    };
    const chain = makeChain({ data: signal, error: null });
    mockCreateClient.mockReturnValue({ from: () => chain });
    const res = await POST(makeReq({
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      body: { source_table: 'buzzes', source_id: 'uuid-1', signal_type: 'hate_speech', severity: 'high' },
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('sig-1');
  });
});

describe('/api/moderation/signals GET', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeReq({}));
    expect(res.status).toBe(401);
  });

  it('returns paginated list of signals', async () => {
    const signals = [{ id: 'sig-1' }, { id: 'sig-2' }];
    const chain = makeChain({ data: signals, error: null });
    mockCreateClient.mockReturnValue({ from: () => chain });
    const res = await GET(makeReq({
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      url: 'http://localhost/api/moderation/signals?limit=10&offset=0',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

describe('/api/moderation/signals/[id] PATCH', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without Authorization header', async () => {
    const res = await PATCH(makeReq({}), { params: Promise.resolve({ id: 'sig-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when signal not found', async () => {
    const chain = makeChain({ data: null, error: { code: 'PGRST116', message: 'not found' } });
    mockCreateClient.mockReturnValue({ from: () => chain });
    const res = await PATCH(
      makeReq({ headers: { authorization: `Bearer ${SERVICE_TOKEN}` }, body: { action_taken: 'flagged' } }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 on valid action_taken update', async () => {
    const updated = { id: 'sig-1', action_taken: 'flagged' };
    const chain = makeChain({ data: updated, error: null });
    mockCreateClient.mockReturnValue({ from: () => chain });
    const res = await PATCH(
      makeReq({ headers: { authorization: `Bearer ${SERVICE_TOKEN}` }, body: { action_taken: 'flagged' } }),
      { params: Promise.resolve({ id: 'sig-1' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action_taken).toBe('flagged');
  });
});
