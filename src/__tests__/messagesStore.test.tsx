/**
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { MessagesProvider, useMessages } from '../lib/messagesStore';
import * as api from '../lib/api';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
    auth: { getUser: jest.fn(() => ({ data: { user: { id: 'u1' } } })) },
  },
}));

jest.mock('../hooks/useAuth', () => {
  const user = { id: 'u1' };
  return {
    useAuth: () => ({ user }),
  };
});

jest.mock('../lib/api', () => ({
  listConversations: jest.fn(),
  markConversationRead: jest.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MessagesProvider>{children}</MessagesProvider>
);

describe('MessagesProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes unreadTotal correctly', async () => {
    (api.listConversations as jest.Mock).mockResolvedValue([
      {
        conversation: { id: 'c1', is_group: false, created_at: '2024-01-01' },
        otherMember: { id: 'u2', username: 'alice' },
        lastMessage: { id: 'm1', body: 'hi', sender_id: 'u2', created_at: '2024-01-02' },
        unread: true,
      },
      {
        conversation: { id: 'c2', is_group: false, created_at: '2024-01-01' },
        otherMember: { id: 'u3', username: 'bob' },
        lastMessage: { id: 'm2', body: 'yo', sender_id: 'u1', created_at: '2024-01-02' },
        unread: false,
      },
    ]);

    const { result } = renderHook(() => useMessages(), { wrapper });

    await waitFor(() => expect(result.current.unreadTotal).toBe(1));
    expect(result.current.conversations).toHaveLength(2);
  });

  it('optimistically marks read', async () => {
    let callCount = 0;
    (api.listConversations as jest.Mock).mockImplementation(() => {
      callCount++;
      const unread = callCount === 1;
      return Promise.resolve([
        {
          conversation: { id: 'c1', is_group: false, created_at: '2024-01-01' },
          otherMember: { id: 'u2', username: 'alice' },
          lastMessage: { id: 'm1', body: 'hi', sender_id: 'u2', created_at: '2024-01-02' },
          unread,
        },
      ]);
    });

    const { result } = renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(result.current.unreadTotal).toBe(1));

    await act(async () => {
      await result.current.markRead('c1');
    });

    await waitFor(() => expect(result.current.unreadTotal).toBe(0));
  });
});
