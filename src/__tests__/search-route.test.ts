/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../app/api/search/route';

const rpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
});

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
});

function request(params: Record<string, string>) {
  const url = new URL('http://localhost/api/search');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return GET(new NextRequest(url));
}

describe('GET /api/search', () => {
  it('rejects short queries', async () => {
    const response = await request({ q: 'x' });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('queries all three ranked RPCs for grouped results', async () => {
    rpc.mockImplementation((name: string) =>
      Promise.resolve({
        data: [{ item: { id: name }, relevance: 0.9, total_count: 6 }],
        error: null,
      })
    );
    const response = await request({ q: 'techno', type: 'all', genre: 'Techno', location: 'Brussels' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledWith(
      'search_ranked_scenes',
      expect.objectContaining({ p_query: 'techno', p_genre: 'Techno', p_location: 'Brussels', p_limit: 4 })
    );
    expect(body.sections.scenes.total).toBe(6);
    expect(body.sections.scenes.hasMore).toBe(true);
  });

  it('queries one entity with offset pagination', async () => {
    rpc.mockResolvedValue({
      data: [{ item: { id: 'mix-21' }, relevance: 0.7, total_count: 25 }],
      error: null,
    });
    const response = await request({ q: 'techno', type: 'mixes', limit: '20', offset: '20' });
    const body = await response.json();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'search_ranked_mixes',
      expect.objectContaining({ p_limit: 20, p_offset: 20 })
    );
    expect(body.sections.mixes.hasMore).toBe(false);
  });

  it('returns a recoverable error when an RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('database unavailable') });
    const response = await request({ q: 'techno', type: 'scenes' });
    expect(response.status).toBe(500);
  });
});
