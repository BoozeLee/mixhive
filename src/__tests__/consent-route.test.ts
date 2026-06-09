/**
 * @jest-environment node
 */
import { POST } from '../app/api/consent/route';

let inserted: Record<string, unknown> | null = null;

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
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
  inserted = null;
});

function req(opts: { auth?: boolean } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/consent', {
    method: 'POST',
    headers,
    body: JSON.stringify({ analytics: true, marketing: false }),
  });
}

describe('POST /api/consent', () => {
  it('records consent anonymously (null user_id)', async () => {
    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    expect(inserted?.analytics).toBe(true);
    expect(inserted?.user_id).toBeNull();
  });

  it('attaches user_id for a signed-in user', async () => {
    const res = await POST(req({ auth: true }) as never);
    expect(res.status).toBe(200);
    expect(inserted?.user_id).toBe('u1');
  });
});
