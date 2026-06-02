// Phase 2 RPC allowlist tests — verifies that find_candidate_promoters and
// get_artist_availability are allowed by the db.rpc tool, and that the
// non-allowlisted functions are still blocked.

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const mockRpc = jest.fn();
const mockSupabase = {
  from: jest.fn(),
  rpc: mockRpc,
};

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

let dbTools: typeof import('@/server/lua-agents/tools/db').dbTools;
beforeAll(async () => {
  const mod = await import('@/server/lua-agents/tools/db');
  dbTools = mod.dbTools;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('db.rpc Phase 2 allowlist', () => {
  it('allows find_candidate_promoters', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'abc', name: 'Fuse Club', city: 'Brussels', genres: ['techno'] }],
      error: null,
    });
    const result = await dbTools['db.rpc']('find_candidate_promoters', {
      p_genres: ['techno'],
      p_city: 'Brussels',
      p_country: 'BE',
      p_limit: 5,
    });
    expect(mockRpc).toHaveBeenCalledWith('find_candidate_promoters', expect.any(Object));
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({ name: 'Fuse Club' });
  });

  it('allows get_artist_availability', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 1, availability_type: 'gig', is_open: true }],
      error: null,
    });
    const result = await dbTools['db.rpc']('get_artist_availability', {
      p_profile_id: 'user-uuid-123',
    });
    expect(mockRpc).toHaveBeenCalledWith('get_artist_availability', expect.any(Object));
    expect(result).toHaveLength(1);
    expect(result[0].availability_type).toBe('gig');
  });

  it('still allows legacy find_candidate_venues', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(
      dbTools['db.rpc']('find_candidate_venues', { p_city: 'Ghent', p_limit: 10 })
    ).resolves.toEqual([]);
  });

  it('still allows match_ai_embeddings', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(dbTools['db.rpc']('match_ai_embeddings', {})).resolves.toEqual([]);
  });

  it('blocks arbitrary functions not in allowlist', async () => {
    await expect(dbTools['db.rpc']('delete_all_data', {})).rejects.toThrow(
      'not in the allowed RPC list'
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns empty array when RPC returns null data', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await dbTools['db.rpc']('find_candidate_promoters', {});
    expect(result).toEqual([]);
  });

  it('throws on Supabase RPC error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function does not exist' },
    });
    await expect(
      dbTools['db.rpc']('get_artist_availability', { p_profile_id: 'x' })
    ).rejects.toThrow('get_artist_availability');
  });
});
