/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/flow-spores/[id]/germinate/route';

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

const req = (body: unknown, authed = true) =>
  new NextRequest('https://test.vercel.app/api/flow-spores/sp1/germinate', {
    method: 'POST',
    headers: authed ? { authorization: 'Bearer t' } : {},
    body: JSON.stringify(body),
  });

const params = { params: Promise.resolve({ id: 'sp1' }) };

describe('POST /api/flow-spores/[id]/germinate', () => {
  it('401 without auth', async () => {
    const res = await POST(req({ target: 'mix_draft' }, false), params);
    expect(res.status).toBe(401);
  });

  it('400 on a missing or unknown target', async () => {
    expect((await POST(req({}), params)).status).toBe(400);
    expect((await POST(req({ target: 'nonsense' }), params)).status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('germinates and reports the incremented generation and lineage', async () => {
    rpcMock.mockResolvedValue({
      data: {
        germination_id: 'g1',
        edge_id: 'e1',
        generation: 1,
        parent_hash: 'a'.repeat(64),
      },
      error: null,
    });
    const res = await POST(req({ target: 'mixhive_session', child_id: 'c1' }), params);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      germination_id: 'g1',
      edge_id: 'e1',
      generation: 1,
      next: null,
    });
    expect(rpcMock).toHaveBeenCalledWith('germinate_flow_spore', {
      p_spore_id: 'sp1',
      p_target: 'mixhive_session',
      p_child_id: 'c1',
    });
  });

  it('points a beehive germination at the download-grant endpoint', async () => {
    rpcMock.mockResolvedValue({
      data: { germination_id: 'g2', edge_id: null, generation: 1, parent_hash: null },
      error: null,
    });
    const res = await POST(req({ target: 'beehive' }), params);
    expect((await res.json()).next).toBe('/api/flow-spores/sp1/grant');
  });

  it('passes a null child_id through rather than omitting it', async () => {
    rpcMock.mockResolvedValue({
      data: { germination_id: 'g3', edge_id: null, generation: 1, parent_hash: null },
      error: null,
    });
    await POST(req({ target: 'mix_draft' }), params);
    expect(rpcMock).toHaveBeenCalledWith(
      'germinate_flow_spore',
      expect.objectContaining({ p_child_id: null })
    );
  });

  it('403 when the caller holds no right to germinate', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized to germinate this spore' },
    });
    expect((await POST(req({ target: 'mix_draft' }), params)).status).toBe(403);
  });

  it('409 when the spore is not sealed', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Spore is not sealed' } });
    expect((await POST(req({ target: 'mix_draft' }), params)).status).toBe(409);
  });

  it('404 when the spore does not exist', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Spore not found' } });
    expect((await POST(req({ target: 'mix_draft' }), params)).status).toBe(404);
  });
});
