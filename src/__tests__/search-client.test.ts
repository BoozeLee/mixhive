import { enhancedSearch, getSearchSuggestions } from '../lib/search';

const response = {
  query: 'techno',
  type: 'all',
  filters: {},
  sections: {
    scenes: {
      items: [
        {
          id: 's1',
          slug: 'techno-brussels',
          name: 'Techno Brussels',
          city: 'Brussels',
          country: 'Belgium',
          genre: 'Techno',
          description: null,
          hero_image_url: null,
        },
      ],
      total: 1,
      hasMore: false,
    },
    profiles: {
      items: [{ id: 'p1', username: 'dj_nef', display_name: 'DJ Nef', avatar_url: null }],
      total: 1,
      hasMore: false,
    },
    mixes: {
      items: [
        {
          id: 'm1',
          title: 'Techno Signal',
          dj_username: 'dj_nef',
          dj_display_name: 'DJ Nef',
          artwork_url: null,
        },
      ],
      total: 1,
      hasMore: false,
    },
  },
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  }) as jest.Mock;
});

it('serializes type, filters, limit, and offset to the search endpoint', async () => {
  await enhancedSearch('techno', { type: 'scenes', genre: 'Techno', location: 'Brussels' }, 20, 10);
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining(
      '/api/search?q=techno&type=scenes&limit=10&offset=20&genre=Techno&location=Brussels'
    )
  );
});

it('builds autocomplete links with profile usernames and scene slugs', async () => {
  const suggestions = await getSearchSuggestions('techno', 10);
  expect(suggestions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'profile', href: '/u/dj_nef' }),
      expect.objectContaining({ type: 'scene', href: '/scene/techno-brussels' }),
      expect.objectContaining({ type: 'mix', href: '/mix/m1' }),
    ])
  );
});
