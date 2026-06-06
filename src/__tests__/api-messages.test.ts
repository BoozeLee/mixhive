import { getOrCreateDm, sendMessage } from '../lib/api';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
    auth: { getUser: jest.fn(() => ({ data: { user: { id: 'u1' } } })) },
  },
}));

const { supabase } = require('../lib/supabase');

describe('Messaging API helpers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getOrCreateDm calls rpc with correct shape', async () => {
    supabase.rpc.mockResolvedValue({ data: 'conv-123', error: null });
    const result = await getOrCreateDm('u2');
    expect(supabase.rpc).toHaveBeenCalledWith('get_or_create_dm', { p_other: 'u2' });
    expect(result).toBe('conv-123');
  });

  it('sendMessage inserts with client-supplied id', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: 'msg-1', body: 'hello', sender_id: 'u1' },
      error: null,
    });
    const mockSelect = jest.fn(() => ({ single: mockSingle }));
    const mockInsert = jest.fn(() => ({ select: mockSelect }));
    supabase.from.mockReturnValue({ insert: mockInsert });

    await sendMessage({ conversationId: 'c1', id: 'msg-1', body: 'hello' });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg-1', conversation_id: 'c1', body: 'hello' })
    );
  });
});
