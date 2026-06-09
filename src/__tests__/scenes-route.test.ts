/**
 * @jest-environment node
 */
import { GET as listScenes } from '../app/api/scenes/route';
import { GET as getScene } from '../app/api/scenes/[slug]/route';

const mockState: {
  sceneRow: unknown;
  sceneList: unknown[];
  listings: unknown[];
  partners: unknown[];
} = { sceneRow: null, sceneList: [], listings: [], partners: [] };

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.order = () => Promise.resolve({ data: mockState.sceneList, error: null });
      builder.eq = chain;
      builder.maybeSingle = () => Promise.resolve({ data: mockState.sceneRow, error: null });
      return builder;
    },
    rpc: (name: string) =>
      Promise.resolve({
        data: name === 'get_scene_listings' ? mockState.listings : mockState.partners,
        error: null,
      }),
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
});

describe('GET /api/scenes', () => {
  it('returns active scenes', async () => {
    mockState.sceneList = [{ slug: 'techno-brussels', name: 'Techno Brussels' }];
    const res = await listScenes();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.scenes).toHaveLength(1);
    expect(body.scenes[0].slug).toBe('techno-brussels');
  });
});

describe('GET /api/scenes/[slug]', () => {
  it('returns scene with listings and partners', async () => {
    mockState.sceneRow = { slug: 'techno-brussels', name: 'Techno Brussels' };
    mockState.listings = [{ user_id: 'u1', display_name: 'Killy', xp: 1250, badge: 'platinum' }];
    mockState.partners = [{ id: 'p1', name: 'Raid Records', verified: true }];
    const res = await getScene({} as never, { params: Promise.resolve({ slug: 'techno-brussels' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.scene.slug).toBe('techno-brussels');
    expect(body.listings[0].badge).toBe('platinum');
    expect(body.partners[0].name).toBe('Raid Records');
  });

  it('404s for an unknown scene', async () => {
    mockState.sceneRow = null;
    const res = await getScene({} as never, { params: Promise.resolve({ slug: 'nope' }) });
    expect(res.status).toBe(404);
  });
});
