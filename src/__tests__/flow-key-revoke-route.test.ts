/** @jest-environment node */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/mythic/sessions/[id]/flow-key/revoke/route';

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

const req = () =>
  new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/revoke', {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
  });

describe('POST .../flow-key/revoke', () => {
  it('401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('voids the open drain', async () => {
    rpcMock.mockResolvedValue({ data: { revoked: true, spore_id: 'sp1' }, error: null });
    const res = await POST(req(), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: true, spore_id: 'sp1' });
    expect(rpcMock).toHaveBeenCalledWith('revoke_flow_key', { p_session_id: 's1' });
  });

  it('is a no-op when no drain is open', async () => {
    rpcMock.mockResolvedValue({ data: { revoked: false }, error: null });
    const res = await POST(req(), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    expect((await res.json()).revoked).toBe(false);
  });

  it('403 for a non-host', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Not authorized', code: '42501' } });
    const res = await POST(req(), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(403);
  });
});
