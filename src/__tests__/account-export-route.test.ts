/**
 * @jest-environment node
 */
import { GET } from '../app/api/account/export/route';

let mockUser: { id: string; email: string } | null = { id: 'u1', email: 'a@b.com' };

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: mockUser ? null : new Error('no') }),
    },
    from: () => ({
      select: () => ({
        // .eq() is both awaitable (grab) and exposes maybeSingle (grabOne)
        eq: () => ({
          then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: [{ id: 'x' }] }),
          maybeSingle: async () => ({ data: { id: 'u1' } }),
        }),
      }),
    }),
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

function req(auth = true) {
  const headers: Record<string, string> = {};
  if (auth) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/account/export', { headers });
}

describe('GET /api/account/export', () => {
  it('401 without auth', async () => {
    const res = await GET(req(false) as never);
    expect(res.status).toBe(401);
  });

  it('returns a data bundle for the user', async () => {
    mockUser = { id: 'u1', email: 'a@b.com' };
    const res = await GET(req() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('u1');
    expect(Array.isArray(body.mixes)).toBe(true);
  });
});
