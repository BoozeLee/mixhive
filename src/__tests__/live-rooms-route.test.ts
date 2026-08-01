/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/live-rooms/route';

const mockRooms = [
  {
    id: 'r1',
    title: 'Test Room',
    status: 'waiting',
    host_id: 'u1',
    max_participants: 8,
    is_public: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

function makeChain(result: unknown = null, error: unknown = null, count?: number) {
  const resolve = (cb: Function) =>
    cb({ data: result, error, count: count ?? (Array.isArray(result) ? result.length : 0) });
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  chain.select = pass;
  chain.order = pass;
  chain.range = pass;
  chain.eq = pass;
  chain.in = pass;
  chain.is = pass;
  chain.then = resolve;
  return chain;
}

const fromMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/live-rooms', () => {
  it('returns rooms with participant counts', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'live_rooms') return makeChain(mockRooms, null, 1);
      if (table === 'live_room_participants')
        return makeChain([{ room_id: 'r1' }, { room_id: 'r1' }]);
      return makeChain([]);
    });

    const res = await GET(new NextRequest('https://test.vercel.app/api/live-rooms'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rooms).toBeDefined();
  });

  it('returns empty list', async () => {
    fromMock.mockReturnValue(makeChain([], null, 0));
    const res = await GET(new NextRequest('https://test.vercel.app/api/live-rooms'));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/live-rooms', () => {
  it('returns 401 without auth', async () => {
    const { POST } = await import('@/app/api/live-rooms/route');
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/live-rooms', { method: 'POST', body: '{}' })
    );
    expect(res.status).toBe(401);
  });
});
