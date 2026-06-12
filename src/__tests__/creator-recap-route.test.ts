/**
 * @jest-environment node
 */
import { GET } from '../app/api/creator/recap/route';

let mockUser: { id: string } | null = { id: 'u1' };

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: mockUser ? null : new Error('no') }),
    },
    rpc: async () => ({
      data: { days: 30, totals: { plays: 10, likes: 2 }, top_mix: null },
      error: null,
    }),
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => {
  mockUser = { id: 'u1' };
});

function req(auth = true) {
  const headers: Record<string, string> = {};
  if (auth) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/creator/recap', { headers });
}

describe('GET /api/creator/recap', () => {
  it('401 without auth', async () => {
    const res = await GET(req(false) as never);
    expect(res.status).toBe(401);
  });

  it('returns the recap payload', async () => {
    const res = await GET(req() as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recap.totals.plays).toBe(10);
  });
});
