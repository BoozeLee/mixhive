/**
 * @jest-environment node
 */
import { fetchOembed } from '@/lib/oembed';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

global.fetch = jest.fn();

describe('oembed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
    }));
  });

  it('resolves YouTube metadata', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Test Video', html: '<iframe></iframe>' }),
    });
    const data = await fetchOembed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(data?.provider).toBe('youtube');
    expect(data?.title).toBe('Test Video');
  });

  it('returns null for unsupported providers', async () => {
    const data = await fetchOembed('https://example.com/video');
    expect(data).toBeNull();
  });
});
