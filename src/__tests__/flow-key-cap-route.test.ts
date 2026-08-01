/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/mythic/sessions/[id]/flow-key/cap/route';

const rpcMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: rpcMock,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null }) }) }) }),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => jest.clearAllMocks());

const params = { params: Promise.resolve({ id: 's1' }) };
const post = (body: unknown, authed = true) =>
  new NextRequest('https://t.app/api/mythic/sessions/s1/flow-key/cap', {
    method: 'POST',
    headers: authed ? { authorization: 'Bearer t' } : {},
    body: JSON.stringify(body),
  });

describe('POST .../flow-key/cap', () => {
  it('401 without auth', async () => {
    expect((await POST(post({ asset_id: 'a1' }, false), params)).status).toBe(401);
  });

  it('400 without an asset_id, and never calls the RPC', async () => {
    expect((await POST(post({}), params)).status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('caps a cell, defaulting capped to true', async () => {
    rpcMock.mockResolvedValue({
      data: { asset_id: 'a1', name: 'kick', capped: true },
      error: null,
    });
    const res = await POST(post({ asset_id: 'a1' }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ capped: true, name: 'kick' });
    expect(rpcMock).toHaveBeenCalledWith('cap_flow_key_cell', {
      p_session_id: 's1',
      p_asset_id: 'a1',
      p_capped: true,
    });
  });

  it('passes capped:false through for uncapping', async () => {
    rpcMock.mockResolvedValue({ data: { capped: false }, error: null });
    await POST(post({ asset_id: 'a1', capped: false }), params);
    expect(rpcMock).toHaveBeenCalledWith(
      'cap_flow_key_cell',
      expect.objectContaining({ p_capped: false })
    );
  });

  it('403 for a non-host — only the host may bend the uncapped rule', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Only creators can cap a cell' } });
    expect((await POST(post({ asset_id: 'a1' }), params)).status).toBe(403);
  });

  it('409 while a drain is open — the boundary cannot shift mid-harvest', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Cannot change capping while a drain is open' },
    });
    const res = await POST(post({ asset_id: 'a1' }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('drain_already_open');
  });

  it('404 when the asset is not in this session', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Asset not found in this session' },
    });
    expect((await POST(post({ asset_id: 'nope' }), params)).status).toBe(404);
  });
});
