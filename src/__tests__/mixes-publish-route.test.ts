/**
 * @jest-environment node
 */
import { POST } from '../app/api/mixes/publish/route';

let mockUser: { id: string } | null = { id: 'user-123' };
let rpcArgs: { name: string; args: Record<string, unknown> } | null = null;
let removed: string[][] = [];
let rpcError: Error | null = null;

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
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      // genres lookup chain
      select: () => ({
        ilike: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: 7 } }) }) }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcArgs = { name, args };
      return rpcError ? { data: null, error: rpcError } : { data: 'mix-1', error: null };
    },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => {
  mockUser = { id: 'user-123' };
  rpcArgs = null;
  removed = [];
  rpcError = null;
});

function makeReq(
  opts: { auth?: boolean; audio?: boolean; title?: string; provenance?: unknown } = {}
) {
  const form = new FormData();
  if (opts.audio !== false) {
    form.append(
      'audio',
      new File([new Uint8Array([1, 2, 3, 4])], 'master.wav', { type: 'audio/wav' })
    );
  }
  const meta: Record<string, unknown> = {
    title: opts.title ?? 'My Track',
    bpm: 128,
    genre: 'Techno',
    durationSecs: 200,
    tags: ['techno'],
  };
  if (opts.provenance !== undefined) meta.provenance = opts.provenance;
  form.append('metadata', JSON.stringify(meta));
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

  it('publishes via the atomic RPC with no credits when no provenance', async () => {
    const res = await POST(makeReq() as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBe('/mix/mix-1');
    expect(rpcArgs?.name).toBe('publish_mix_with_credits');
    const pMix = rpcArgs?.args.p_mix as Record<string, unknown>;
    const pCredits = rpcArgs?.args.p_credits as unknown[];
    expect(pMix.genre_id).toBe(7);
    expect((pMix.platform_links as { source: string }).source).toBe('mixhive');
    // dj_id is forced inside the RPC, never sent from the route payload.
    expect(pMix.dj_id).toBeUndefined();
    expect(pCredits).toEqual([]);
  });

  it('ingests AI-agent provenance as slugified credit rows', async () => {
    const provenance = {
      agents: [
        { name: 'Acid Oracle', role: 'Beatsmith', contribution: 'acid line', model: 'fable-5' },
        { name: '   ', role: 'ignored' }, // dropped: blank name
        { name: 'Echo Warden' },
      ],
    };
    const res = await POST(makeReq({ provenance }) as never);
    expect(res.status).toBe(200);
    const pCredits = rpcArgs?.args.p_credits as Array<Record<string, unknown>>;
    expect(pCredits).toHaveLength(2);
    expect(pCredits[0]).toMatchObject({
      agent_slug: 'acid-oracle',
      agent_name: 'Acid Oracle',
      agent_role: 'Beatsmith',
      model: 'fable-5',
    });
    expect(pCredits[1]).toMatchObject({ agent_slug: 'echo-warden', agent_name: 'Echo Warden' });
  });

  it('rolls back the upload and 500s when the publish RPC fails', async () => {
    rpcError = new Error('rpc boom');
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(500);
    expect(removed).toHaveLength(1); // orphaned audio removed
  });
});
