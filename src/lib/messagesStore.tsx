import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import type { ConversationSummary } from './types';
import { useAuth } from '../hooks/useAuth';
import { listConversations, markConversationRead } from './api';

export interface MessagesContextType {
  conversations: ConversationSummary[];
  unreadTotal: number;
  refresh: () => Promise<void>;
  markRead: (conversationId: string) => Promise<void>;
}

const MessagesContext = createContext<MessagesContextType | null>(null);

export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const fetchConversations = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setConversations([]);
      return;
    }
    try {
      const data = await listConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setConversations([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    void fetchConversations();

    const channel = supabase
      .channel('messages-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          void fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  const markRead = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      setConversations(prev =>
        prev.map(c =>
          c.conversation.id === conversationId ? { ...c, unread: false } : c
        )
      );
      await markConversationRead(conversationId);
      void fetchConversations();
    },
    [user, fetchConversations]
  );

  const unreadTotal = conversations.filter(c => c.unread).length;

  return (
    <MessagesContext.Provider
      value={{
        conversations,
        unreadTotal,
        refresh: fetchConversations,
        markRead,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used within MessagesProvider');
  return ctx;
}
