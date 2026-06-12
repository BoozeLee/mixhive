/**
 * @jest-environment node
 */
import { POST } from '../app/api/mixes/publish/route';

let mockUser: { id: string } | null = { id: 'user-123' };
let insertedRow: Record<string, unknown> | null = null;

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockUser ? null : new Error('no user'),
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
      }),
    },
    from: () => ({
      // genres lookup chain
      select: () => ({
        ilike: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: 7 } }) }) }),
      }),
      // mixes insert chain
      insert: (row: Record<string, unknown>) => {
        insertedRow = row;
        return { select: () => ({ single: async () => ({ data: { id: 'mix-1' }, error: null }) }) };
      },
    }),
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => {
  mockUser = { id: 'user-123' };
  insertedRow = null;
});

function makeReq(opts: { auth?: boolean; audio?: boolean; title?: string } = {}) {
  const form = new FormData();
  if (opts.audio !== false) {
    form.append(
      'audio',
      new File([new Uint8Array([1, 2, 3, 4])], 'master.wav', { type: 'audio/wav' })
    );
  }
  form.append(
    'metadata',
    JSON.stringify({
      title: opts.title ?? 'My Track',
      bpm: 128,
      genre: 'Techno',
      durationSecs: 200,
      tags: ['techno'],
    })
  );
  const headers: Record<string, string> = {};
  if (opts.auth !== false) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/mixes/publish', { method: 'POST', body: form, headers });
}

describe('POST /api/mixes/publish', () => {
  it('401 without auth header', async () => {
    const res = await POST(makeReq({ auth: false }) as never);
    expect(res.status).toBe(401);
  });

  it('400 when audio is missing', async () => {
    const res = await POST(makeReq({ audio: false }) as never);
    expect(res.status).toBe(400);
  });

  it('400 when title is missing', async () => {
    const res = await POST(makeReq({ title: '' }) as never);
    expect(res.status).toBe(400);
  });

  it('publishes a mix and derives dj_id from the verified JWT', async () => {
    const res = await POST(makeReq() as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBe('/mix/mix-1');
    expect(insertedRow?.dj_id).toBe('user-123');
    expect((insertedRow?.platform_links as { source: string }).source).toBe('beehive-studio');
    expect(insertedRow?.genre_id).toBe(7);
  });
});
