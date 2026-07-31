/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { Wallet } from 'ethers';
import { countersignMessage } from '@/lib/flow-key/countersign';
import { GET, POST } from '@/app/api/flow-spores/[id]/countersign/route';

const wallet = Wallet.createRandom();
const stranger = Wallet.createRandom();

const spore = {
  id: 'sp1',
  session_id: 'se1',
  content_hash: 'a'.repeat(64),
  state: 'sealed',
};

const fromMock = jest.fn();
const rpcMock = jest.fn();

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  const pass = () => c;
  const thenable = { then: (r: Function) => r({ data: result, error: null }) };
  c.select = pass;
  c.eq = pass;
  c.maybeSingle = () => thenable;
  c.then = thenable.then;
  return c;
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));
jest.mock('@/lib/supabase', () => ({ createServerClient: () => ({ rpc: rpcMock }) }));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockImplementation(() => chain(spore));
  rpcMock.mockResolvedValue({ data: { countersigned: true }, error: null });
});

const params = { params: Promise.resolve({ id: 'sp1' }) };
const post = (body: unknown) =>
  new NextRequest('https://t.app/api/flow-spores/sp1/countersign', {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });

const subject = {
  sporeId: 'sp1',
  contentHash: 'a'.repeat(64),
  sessionId: 'se1',
  address: wallet.address,
};

describe('GET .../countersign', () => {
  it('returns the exact message the client must sign', async () => {
    const res = await GET(
      new NextRequest(`https://t.app/api/flow-spores/sp1/countersign?address=${wallet.address}`, {
        headers: { authorization: 'Bearer t' },
      }),
      params
    );
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(countersignMessage(subject));
  });

  it('400 without a valid address', async () => {
    const res = await GET(
      new NextRequest('https://t.app/api/flow-spores/sp1/countersign?address=nope', {
        headers: { authorization: 'Bearer t' },
      }),
      params
    );
    expect(res.status).toBe(400);
  });
});

describe('POST .../countersign', () => {
  it('401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://t.app/api/flow-spores/sp1/countersign', { method: 'POST' }),
      params
    );
    expect(res.status).toBe(401);
  });

  it('records a valid countersignature', async () => {
    const signature = await wallet.signMessage(countersignMessage(subject));
    const res = await POST(post({ address: wallet.address, signature }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ countersigned: true });
    expect(rpcMock).toHaveBeenCalledWith(
      'record_flow_spore_countersignature',
      expect.objectContaining({ p_spore_id: 'sp1', p_profile_id: 'u1' })
    );
  });

  it('400 and never records when the signer is not the claimed address', async () => {
    const signature = await stranger.signMessage(countersignMessage(subject));
    const res = await POST(post({ address: wallet.address, signature }), params);
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('400 on a garbage signature, without touching the database', async () => {
    const res = await POST(post({ address: wallet.address, signature: '0xdead' }), params);
    expect(res.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('403 when the signer is not a contributor on this spore', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not a carbon contributor on this spore' },
    });
    const signature = await wallet.signMessage(countersignMessage(subject));
    const res = await POST(post({ address: wallet.address, signature }), params);
    expect(res.status).toBe(403);
  });

  it('409 when the spore is not sealed', async () => {
    fromMock.mockImplementation(() => chain({ ...spore, state: 'draining' }));
    const signature = await wallet.signMessage(countersignMessage(subject));
    const res = await POST(post({ address: wallet.address, signature }), params);
    expect(res.status).toBe(409);
  });
});
