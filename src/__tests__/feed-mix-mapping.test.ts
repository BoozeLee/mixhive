// Regression: the Feed's trending/latest tabs rendered mixes with no author or
// genre because getTrending/getRecentMixes returned raw RPC rows (nested
// profiles/genres) without running them through formatFeedMix — the same
// mapping getTrendingMixes (Discover) already applies to the same RPC.

const rpc = jest.fn();

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { getTrending, getRecentMixes } from '../lib/api';

const row = {
  id: 'mix-1',
  title: 'Warehouse Set',
  created_at: '2026-06-12T00:00:00Z',
  score: 42,
  audio_url: 'https://example.test/a.mp3',
  profiles: {
    id: 'dj-1',
    username: 'neo',
    display_name: 'DJ Neo',
    avatar_url: 'https://example.test/neo.png',
  },
  genres: { name: 'Techno' },
};

describe('feed mix mapping', () => {
  beforeEach(() => rpc.mockReset());

  it('getTrending flattens nested profiles/genres into MixCard fields', async () => {
    rpc.mockResolvedValue({ data: [row] });
    const { data } = await getTrending(20);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Warehouse Set');
    expect(data[0].dj_display_name).toBe('DJ Neo');
    expect(data[0].dj_username).toBe('neo');
    expect(data[0].genre_name).toBe('Techno');
  });

  it('getRecentMixes applies the same flattening', async () => {
    rpc.mockResolvedValue({ data: [row] });
    const { data } = await getRecentMixes(20);
    expect(data[0].dj_display_name).toBe('DJ Neo');
    expect(data[0].genre_name).toBe('Techno');
    expect(data[0].created_at).toBe('2026-06-12T00:00:00Z');
  });
});
