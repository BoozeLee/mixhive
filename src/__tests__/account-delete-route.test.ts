/**
 * @jest-environment node
 */
import { POST } from '../app/api/account/delete/route';

let mockUser: { id: string } | null = { id: 'u1' };
let inserted: Record<string, unknown> | null = null;

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: mockUser ? null : new Error('no') }) },
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted = row;
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => {
  mockUser = { id: 'u1' };
  inserted = null;
});

function req(auth = true) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/account/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'leaving' }),
  });
}

describe('POST /api/account/delete', () => {
  it('401 without auth', async () => {
    const res = await POST(req(false) as never);
    expect(res.status).toBe(401);
  });

  it('queues a deletion request for the user', async () => {
    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    expect(inserted?.user_id).toBe('u1');
  });
});
