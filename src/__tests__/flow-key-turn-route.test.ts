/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/mythic/sessions/[id]/flow-key/route';

const assets = [
  { id: 'a1', created_at: '2020-01-01T21:00:00.000Z', upload_complete: true, deleted_at: null },
  { id: 'a2', created_at: '2020-01-02T21:30:00.000Z', upload_complete: true, deleted_at: null },
];
const state = { current_asset_id: 'a2', playback_status: 'playing' };
const tap = { is_open: false, opened_at: null, turns_count: 0, drain_lock: null };

const fromMock = jest.fn();
const rpcMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    rpc: rpcMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

function makeChain(result: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  const thenable = { then: (resolve: Function) => resolve({ data: result, error }) };
  chain.select = pass;
  chain.eq = pass;
  chain.is = pass;
  chain.order = pass;
  chain.maybeSingle = () => thenable;
  chain.single = () => thenable;
  chain.then = thenable.then;
  return chain;
}

function wire(assetRows: unknown = assets) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'collab_session_assets') return makeChain(assetRows);
    if (table === 'collab_session_state') return makeChain(state);
    if (table === 'flow_key_taps') return makeChain(tap);
    if (table === 'collab_session_events') return makeChain([]);
    return makeChain(null);
  });
}

const authed = (method: string) =>
  new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key', {
    method,
    headers: { authorization: 'Bearer token' },
  });

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => {
  jest.clearAllMocks();
  wire();
});

describe('POST /api/mythic/sessions/[id]/flow-key', () => {
  it('401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('turns the key and reports the capped count, excluding the live take', async () => {
    rpcMock.mockResolvedValue({
      data: { spore_id: 'sp1', opened_at: '2026-07-30T22:00:00.000Z', turns_count: 1 },
      error: null,
    });
    const res = await POST(authed('POST'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ spore_id: 'sp1', capped: 1, skipped: 1, turns_count: 1 });
    expect(rpcMock).toHaveBeenCalledWith('turn_flow_key', { p_session_id: 's1' });
  });

  it('422 nothing_capped when only the live take exists, and does not open the tap', async () => {
    wire([
      {
        id: 'a2',
        created_at: '2020-01-02T21:30:00.000Z',
        upload_complete: true,
        deleted_at: null,
      },
    ]);
    const res = await POST(authed('POST'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('nothing_capped');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('409 drain_already_open when the RPC reports the lock is taken', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'drain_already_open', code: '55006' },
    });
    const res = await POST(authed('POST'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('drain_already_open');
  });

  it('403 when the caller is not a host', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized: only creators can turn the Flow Key', code: '42501' },
    });
    const res = await POST(authed('POST'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/mythic/sessions/[id]/flow-key', () => {
  it('reports tap state and live capped counts for the room', async () => {
    const res = await GET(authed('GET'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      is_open: false,
      turns_count: 0,
      capped: 1,
      skipped: 1,
    });
  });

  it('401 without auth', async () => {
    const res = await GET(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key'),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });
});
