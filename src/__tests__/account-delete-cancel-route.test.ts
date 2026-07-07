/**
 * @jest-environment node
 */
import { POST } from '../app/api/account/delete/cancel/route';

let mockUser: { id: string } | null = { id: 'u1' };
let updateError: Error | null = null;

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: mockUser ? null : new Error('no') }),
    },
    from: () => ({
      update: (_row: Record<string, unknown>) => {
        return {
          eq: (_col: string, _val: string) => ({
            eq: () => Promise.resolve({ error: updateError }),
          }),
        };
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
  updateError = null;
});

function req(auth = true) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/account/delete/cancel', { method: 'POST', headers });
}

describe('POST /api/account/delete/cancel', () => {
  it('401 without auth', async () => {
    const res = await POST(req(false) as never);
    expect(res.status).toBe(401);
  });

  it('cancels a pending deletion request', async () => {
    const res = await POST(req() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('cancelled');
  });

  it('500 when update fails', async () => {
    updateError = new Error('db error');
    const res = await POST(req() as never);
    expect(res.status).toBe(500);
  });
});
