import { useState, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import type { AudioFeature } from './types';

export interface AgentSuggestion {
  type: string;
  payload?: Record<string, unknown>;
  rationale?: string;
  confidence?: number;
  requires_approval?: boolean;
}

export interface StreamEvent {
  type: 'features' | 'status' | 'suggestions' | 'complete' | 'error';
  data?: Record<string, unknown>;
}

export interface AgentStreamOptions {
  agentId?: string;
  context?: Record<string, unknown>;
  bustCache?: boolean;
}

export interface StreamState {
  features: AudioFeature | null;
  suggestions: AgentSuggestion[];
  statusMessage: string | null;
  running: boolean;
  error: string | null;
  complete: boolean;
  cached: boolean;
}

export function useAgentStream() {
  const [state, setState] = useState<StreamState>({
    features: null,
    suggestions: [],
    statusMessage: null,
    running: false,
    error: null,
    complete: false,
    cached: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (mixId: string, opts?: AgentStreamOptions) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setState({
      features: null,
      suggestions: [],
      statusMessage: null,
      running: true,
      error: null,
      complete: false,
      cached: false,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const res = await fetch('/api/ai/agent-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mixId,
          agentId: opts?.agentId ?? 'dj_set_analyzer',
          context: opts?.context,
          bustCache: opts?.bustCache ?? false,
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Stream failed: ${res.status} ${text}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            handleEvent(eventType, data);
            eventType = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState(prev => ({
        ...prev,
        running: false,
        error: err instanceof Error ? err.message : 'Stream failed',
      }));
    }
  }, []);

  function handleEvent(type: string, data: Record<string, unknown>) {
    switch (type) {
      case 'features':
        setState(prev => ({
          ...prev,
          features: (data.feature as AudioFeature) ?? null,
        }));
        break;
      case 'status':
        setState(prev => ({
          ...prev,
          statusMessage: (data.message as string) ?? null,
        }));
        break;
      case 'suggestions':
        setState(prev => ({
          ...prev,
          suggestions: (data.suggestions as AgentSuggestion[]) ?? [],
        }));
        break;
      case 'complete':
        setState(prev => ({
          ...prev,
          running: false,
          complete: true,
          statusMessage: null,
          cached: (data.cached as boolean) ?? false,
        }));
        break;
      case 'error':
        setState(prev => ({
          ...prev,
          running: false,
          error: (data.message as string) ?? 'Unknown error',
        }));
        break;
    }
  }

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState({
      features: null,
      suggestions: [],
      statusMessage: null,
      running: false,
      error: null,
      complete: false,
      cached: false,
    });
  }, []);

  return { ...state, start, cancel };
}
