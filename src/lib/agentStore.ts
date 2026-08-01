import { create } from 'zustand';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface StoreSuggestion {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  rationale: string | null;
  confidence: number;
  status: 'pending' | 'applied' | 'rejected';
  source: string;
  created_at: string;
}

export interface AgentStoreState {
  suggestions: StoreSuggestion[];
  running: boolean;
  lastError: string | null;
  lastRunAt: string | null;
}

export interface AgentStoreActions {
  setRunning: (running: boolean) => void;
  setError: (error: string | null) => void;
  addSuggestions: (suggestions: StoreSuggestion[]) => void;
  updateSuggestion: (id: string, updates: Partial<StoreSuggestion>) => void;
  clearSuggestions: () => void;
  subscribe: (userId: string) => () => void;
}

export const useAgentStore = create<AgentStoreState & AgentStoreActions>((set, get) => ({
  suggestions: [],
  running: false,
  lastError: null,
  lastRunAt: null,

  setRunning: running =>
    set({ running, lastRunAt: running ? new Date().toISOString() : get().lastRunAt }),

  setError: lastError => set({ lastError }),

  addSuggestions: suggestions =>
    set(state => ({
      suggestions: [...suggestions, ...state.suggestions].slice(0, 100),
    })),

  updateSuggestion: (id, updates) =>
    set(state => ({
      suggestions: state.suggestions.map(s => (s.id === id ? { ...s, ...updates } : s)),
    })),

  clearSuggestions: () => set({ suggestions: [] }),

  subscribe: userId => {
    const channel: RealtimeChannel = supabase
      .channel(`agent-store:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_suggestions',
          filter: `profile_id=eq.${userId}`,
        },
        payload => {
          const newSuggestion = payload.new as StoreSuggestion;
          set(state => ({
            suggestions: [newSuggestion, ...state.suggestions].slice(0, 100),
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_suggestions',
          filter: `profile_id=eq.${userId}`,
        },
        payload => {
          const updated = payload.new as StoreSuggestion;
          set(state => ({
            suggestions: state.suggestions.map(s => (s.id === updated.id ? updated : s)),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
