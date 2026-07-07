// Tests for mythic.node.find_or_create and mythic.edge.create tools.

const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();
const _mockSelectChain = { eq: jest.fn(), maybeSingle: mockMaybeSingle };
const mockInsertChain = { select: jest.fn(() => ({ single: mockSingle })) };
const mockEdgeInsert = jest.fn();

const mockFrom = jest.fn((table: string) => {
  if (table === 'mythic_nodes') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({ maybeSingle: mockMaybeSingle })),
        })),
      })),
      insert: jest.fn(() => mockInsertChain),
    };
  }
  if (table === 'mythic_edges') {
    return { insert: mockEdgeInsert };
  }
  return {};
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

let mythicTools: typeof import('@/server/lua-agents/tools/mythic').mythicTools;
beforeAll(async () => {
  const mod = await import('@/server/lua-agents/tools/mythic');
  mythicTools = mod.mythicTools;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('mythic.node.find_or_create', () => {
  it('returns existing node id without inserting on cache hit', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'existing-uuid' }, error: null });

    const result = await mythicTools['mythic.node.find_or_create']({
      node_type: 'artist_profile',
      source_table: 'profiles',
      source_id: 'profile-abc',
      title: 'Artist',
      owner_id: 'profile-abc',
    });

    expect(result).toBe('existing-uuid');
    // insert should NOT have been called
    const profileCalls = mockFrom.mock.calls.filter(([t]) => t === 'mythic_nodes');
    const _insertCalls = profileCalls.filter((_, i) => {
      const returnVal = mockFrom.mock.results[i]?.value;
      return typeof returnVal?.insert === 'function';
    });
    // The from call that hit "insert" should not have been invoked
    expect(mockInsertChain.select).not.toHaveBeenCalled();
  });

  it('inserts and returns new id on cache miss', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSingle.mockResolvedValueOnce({ data: { id: 'new-uuid' }, error: null });

    const result = await mythicTools['mythic.node.find_or_create']({
      node_type: 'opportunity',
      source_table: 'opportunities',
      source_id: 'opp-123',
      title: 'Gig',
      owner_id: 'profile-abc',
    });

    expect(result).toBe('new-uuid');
    expect(mockSingle).toHaveBeenCalled();
  });

  it('throws on supabase insert error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    await expect(
      mythicTools['mythic.node.find_or_create']({
        node_type: 'opportunity',
        source_table: 'opportunities',
        source_id: 'opp-456',
        title: 'Gig',
        owner_id: 'profile-abc',
      })
    ).rejects.toThrow('mythic.node.find_or_create');
  });
});

describe('mythic.edge.create', () => {
  it('inserts edge with correct fields and returns true', async () => {
    mockEdgeInsert.mockResolvedValueOnce({ error: null });

    const result = await mythicTools['mythic.edge.create']({
      from_node_id: 'node-a',
      to_node_id: 'node-b',
      edge_type: 'submitted_to',
      weight: 0.85,
      source_event: 'booking_scout',
    });

    expect(result).toBe(true);
    expect(mockEdgeInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        from_node_id: 'node-a',
        to_node_id: 'node-b',
        edge_type: 'submitted_to',
        weight: 0.85,
        source_event: 'booking_scout',
      })
    );
  });

  it('defaults weight to 1.0 and source_event to agent', async () => {
    mockEdgeInsert.mockResolvedValueOnce({ error: null });

    await mythicTools['mythic.edge.create']({
      from_node_id: 'node-a',
      to_node_id: 'node-b',
      edge_type: 'collab_with',
    });

    expect(mockEdgeInsert).toHaveBeenCalledWith(
      expect.objectContaining({ weight: 1.0, source_event: 'agent' })
    );
  });

  it('throws on supabase error', async () => {
    mockEdgeInsert.mockResolvedValueOnce({ error: { message: 'constraint violation' } });

    await expect(
      mythicTools['mythic.edge.create']({
        from_node_id: 'node-a',
        to_node_id: 'node-b',
        edge_type: 'performed_at',
      })
    ).rejects.toThrow('mythic.edge.create');
  });
});
