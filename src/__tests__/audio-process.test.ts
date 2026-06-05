/**
 * @jest-environment node
 */

const SERVICE_TOKEN = 'test-audio-service-token';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.SERVICE_ROLE_TOKEN = SERVICE_TOKEN;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/database-queries', () => ({
  enqueue_audio_job: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { POST } from '../app/api/audio/process/route';

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

function makeSupabase(
  fromResult: { data: unknown; error: unknown },
  rpcResult: { data: unknown; error: unknown } = { data: 'job-uuid', error: null }
) {
  const fromChain = makeChain(fromResult);
  const rpcChain = makeChain(rpcResult);
  return {
    from: jest.fn().mockReturnValue(fromChain),
    rpc: jest.fn().mockReturnValue(rpcChain),
  };
}

function makeReq(opts: { headers?: Record<string, string>; body?: unknown }) {
  return {
    headers: { get: (k: string) => (opts.headers ?? {})[k.toLowerCase()] ?? null },
    json: async () => opts.body ?? {},
  } as unknown as NextRequest;
}

describe('/api/audio/process POST', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without Authorization header', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong service token', async () => {
    const res = await POST(makeReq({ headers: { authorization: 'Bearer wrong-token' } }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when mix not found', async () => {
    mockCreateClient.mockReturnValue(makeSupabase({ data: null, error: { message: 'not found' } }));
    const res = await POST(
      makeReq({
        headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
        body: { mixId: 'nonexistent', jobType: 'waveform' },
      })
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 with queued status on success', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabase(
        {
          data: { id: 'mix-1', upload_status: 'uploaded', file_url: 'https://cdn/mix.mp3' },
          error: null,
        },
        { data: 'job-uuid-1', error: null }
      )
    );
    const res = await POST(
      makeReq({
        headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
        body: { mixId: 'mix-1', jobType: 'waveform' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('queued');
  });

  it('returns 200 with already_complete when mix upload_status is ready', async () => {
    mockCreateClient.mockReturnValue(
      makeSupabase({
        data: { id: 'mix-1', upload_status: 'ready', file_url: 'https://cdn/mix.mp3' },
        error: null,
      })
    );
    const res = await POST(
      makeReq({
        headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
        body: { mixId: 'mix-1', jobType: 'waveform' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('already_complete');
  });
});
