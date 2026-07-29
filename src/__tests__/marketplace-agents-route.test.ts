/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/marketplace/agents/route';

const mockPackages = [
  { id: 'a1', name: 'BeatMatcher', category: 'discovery', price: 0, install_count: 10 },
];

const rpcMock = jest.fn().mockResolvedValue({ data: mockPackages, error: null });

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: rpcMock,
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/marketplace/agents', () => {
  it('returns agent packages', async () => {
    const res = await GET(new NextRequest('https://test.vercel.app/api/marketplace/agents'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.packages).toHaveLength(1);
    expect(body.packages[0].name).toBe('BeatMatcher');
  });

  it('passes filters to RPC', async () => {
    await GET(new NextRequest('https://test.vercel.app/api/marketplace/agents?category=discovery&discipline=dj&free=true&limit=10'));
    expect(rpcMock).toHaveBeenCalledWith(
      'list_agent_packages',
      expect.objectContaining({
        p_category: 'discovery',
        p_discipline: 'dj',
        p_free_only: true,
        p_limit: 10,
      })
    );
  });

  it('returns 500 on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const res = await GET(new NextRequest('https://test.vercel.app/api/marketplace/agents'));
    expect(res.status).toBe(500);
  });
});
