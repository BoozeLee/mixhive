/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { generateSealKeyPair, verifyGenome } from '@/lib/flow-key/seal';

const { privateKeyPem, publicKeyPem } = generateSealKeyPair();

const spore = {
  id: 'sp1',
  session_id: 's1',
  state: 'draining',
  opened_at: '2026-07-30T22:00:00.000Z',
  generation: 0,
  parent_hash: null,
  turned_by: 'u1',
};

const rpcMock = jest.fn();
const fromMock = jest.fn();
const uploadMock = jest.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });

function makeChain(result: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  const thenable = { then: (resolve: Function) => resolve({ data: result, error }) };
  chain.select = pass;
  chain.eq = pass;
  chain.maybeSingle = () => thenable;
  chain.single = () => thenable;
  chain.then = thenable.then;
  return chain;
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    rpc: rpcMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: fromMock,
    rpc: rpcMock,
    storage: { from: () => ({ upload: uploadMock }) },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.FLOW_KEY_SEAL_KEY = privateKeyPem;
  process.env.FLOW_KEY_SEAL_KEY_ID = 'fk-test';
});

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockImplementation((table: string) => {
    if (table === 'flow_spores') return makeChain(spore);
    if (table === 'collab_session_assets')
      return makeChain([
        {
          id: 'a1',
          name: 'kick',
          created_at: '2020-01-01T21:00:00.000Z',
          upload_complete: true,
          deleted_at: null,
          uploader_id: 'u1',
          duration_seconds: 120,
          metadata: { digest: 'd1' },
        },
      ]);
    if (table === 'collab_session_state')
      return makeChain({ current_asset_id: null, playback_status: 'paused' });
    if (table === 'collab_session_events') return makeChain([]);
    return makeChain(null);
  });
  rpcMock.mockResolvedValue({ data: { id: 'sp1', state: 'sealed' }, error: null });
});

const sealReq = () =>
  new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/seal', {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify({ spore_id: 'sp1' }),
  });

describe('POST .../flow-key/seal', () => {
  it('401 without auth', async () => {
    const { POST } = await import('@/app/api/mythic/sessions/[id]/flow-key/seal/route');
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/seal', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('seals with a verifiable signature and calls the RPC', async () => {
    const { POST } = await import('@/app/api/mythic/sessions/[id]/flow-key/seal/route');
    const res = await POST(sealReq(), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.capped).toBe(1);
    expect(rpcMock).toHaveBeenCalledWith(
      'seal_flow_spore',
      expect.objectContaining({
        p_spore_id: 'sp1',
        p_content_hash: body.content_hash,
        p_key_id: 'fk-test',
      })
    );
    const call = rpcMock.mock.calls[0][1];
    expect(verifyGenome(body.content_hash, call.p_signature, publicKeyPem)).toBe(true);
  });

  it('uploads the spore document to the private flow-spores bucket', async () => {
    const { POST } = await import('@/app/api/mythic/sessions/[id]/flow-key/seal/route');
    await POST(sealReq(), { params: Promise.resolve({ id: 's1' }) });
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringContaining('sp1'),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/json' })
    );
  });

  it('404 when the spore is not draining', async () => {
    fromMock.mockImplementation((table: string) =>
      table === 'flow_spores' ? makeChain(null) : makeChain([])
    );
    const { POST } = await import('@/app/api/mythic/sessions/[id]/flow-key/seal/route');
    const res = await POST(sealReq(), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(404);
  });
});
