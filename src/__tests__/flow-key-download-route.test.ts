/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';

const updateResult: { data: unknown } = { data: null };
const fromMock = jest.fn();

function grantChain() {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  chain.update = pass;
  chain.eq = pass;
  chain.is = pass;
  chain.gt = pass;
  chain.select = pass;
  chain.maybeSingle = () => ({
    then: (resolve: Function) => resolve({ data: updateResult.data, error: null }),
  });
  return chain;
}

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: fromMock,
    storage: {
      from: () => ({
        download: jest
          .fn()
          .mockResolvedValue({ data: { text: async () => '{"genome":{}}' }, error: null }),
      }),
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockImplementation((table: string) => {
    if (table === 'flow_spore_grants') return grantChain();
    if (table === 'flow_spores')
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({
              then: (r: Function) => r({ data: { storage_path: 's1/sp1.json' }, error: null }),
            }),
          }),
        }),
      };
    return grantChain();
  });
});

describe('GET /api/flow-spores/[id]/download', () => {
  it('400 without a token', async () => {
    const { GET } = await import('@/app/api/flow-spores/[id]/download/route');
    const res = await GET(new NextRequest('https://test.vercel.app/api/flow-spores/sp1/download'), {
      params: Promise.resolve({ id: 'sp1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns the spore document for a fresh token', async () => {
    updateResult.data = { id: 'g1' };
    const { GET } = await import('@/app/api/flow-spores/[id]/download/route');
    const res = await GET(
      new NextRequest('https://test.vercel.app/api/flow-spores/sp1/download?token=abc'),
      { params: Promise.resolve({ id: 'sp1' }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ genome: {} });
  });

  it('410 when the token was already used or expired', async () => {
    updateResult.data = null;
    const { GET } = await import('@/app/api/flow-spores/[id]/download/route');
    const res = await GET(
      new NextRequest('https://test.vercel.app/api/flow-spores/sp1/download?token=abc'),
      { params: Promise.resolve({ id: 'sp1' }) }
    );
    expect(res.status).toBe(410);
  });
});

describe('GET /.well-known/mixhive-flow-key.json', () => {
  it('publishes the seal public key without ever exposing the private key', async () => {
    const { generateSealKeyPair } = await import('@/lib/flow-key/seal');
    const { privateKeyPem } = generateSealKeyPair();
    process.env.FLOW_KEY_SEAL_KEY = privateKeyPem;
    process.env.FLOW_KEY_SEAL_KEY_ID = 'fk-test';
    const { GET } = await import('@/app/.well-known/mixhive-flow-key.json/route');
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.algorithm).toBe('ed25519');
    expect(body.keys[0]).toMatchObject({ key_id: 'fk-test' });
    expect(body.keys[0].public_key_pem).toContain('BEGIN PUBLIC KEY');
    expect(JSON.stringify(body)).not.toContain('PRIVATE');
  });

  it('returns an empty key list rather than 500 when unconfigured', async () => {
    delete process.env.FLOW_KEY_SEAL_KEY;
    const { GET } = await import('@/app/.well-known/mixhive-flow-key.json/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).keys).toEqual([]);
  });
});
