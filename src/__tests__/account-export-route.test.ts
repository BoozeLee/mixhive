/**
 * @jest-environment node
 */
import { GET } from '../app/api/account/export/route';

let mockUser: { id: string; email: string } | null = { id: 'u1', email: 'dj@example.com' };

// Store mock data on globalThis to survive jest.mock() hoisting.
const STORE = '__mockData';
(globalThis as Record<string, unknown>)[STORE] = {};

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: mockUser ? null : new Error('no') }),
    },
    from: (table: string) => {
      const eq = () => ({
        maybeSingle: async () => {
          const store = (globalThis as Record<string, unknown>)[STORE] as Record<string, unknown[]>;
          const rows = store[table];
          return { data: rows?.[0] ?? null, error: null };
        },
        then: (cb: (v: { data: unknown[]; error: null }) => void) => {
          const store = (globalThis as Record<string, unknown>)[STORE] as Record<string, unknown[]>;
          return Promise.resolve(cb({ data: store[table] ?? [], error: null }));
        },
      });
      return { select: () => ({ eq }) };
    },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

beforeEach(() => {
  mockUser = { id: 'u1', email: 'dj@example.com' };
  (globalThis as Record<string, unknown>)[STORE] = {
    profiles: [{ id: 'u1', username: 'djtest' }],
    mixes: [{ id: 'm1', title: 'My mix' }],
    playlists: [],
    comments: [{ id: 'c1', body: 'nice track' }],
    follows: [],
    user_consents: [{ analytics: true }],
  };
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

  it('returns user data as JSON bundle', async () => {
    const res = await GET(req() as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('Content-Disposition')).toContain('mixhive-data');

    const body = await res.json();
    expect(body.user.id).toBe('u1');
    expect(body.user.email).toBe('dj@example.com');
    expect(body.profile.username).toBe('djtest');
    expect(body.mixes).toHaveLength(1);
    expect(body.comments).toHaveLength(1);
    expect(body.playlists).toEqual([]);
    expect(body.follows).toEqual([]);
    expect(body.consents).toHaveLength(1);
    expect(body.exported_at).toBeDefined();
  });
});
