import { supabase } from './supabase';

export type RitualRole = 'owner' | 'creator' | 'moderator' | 'audience';

export interface RitualAsset {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  duration_seconds: number | null;
  asset_type: 'stem' | 'mix' | 'preview';
  uploader_id: string;
  /** Needed by the Flow Key capping boundary. */
  created_at?: string;
}

export type GerminationTarget = 'beehive' | 'mixhive_session' | 'mix_draft';

/** A sealed spore as returned by GET /api/flow-spores. */
export interface FlowSpore {
  id: string;
  session_id: string;
  state: 'draining' | 'sealed' | 'void';
  sealed_at: string | null;
  generation: number;
  content_hash: string | null;
  parent_hash: string | null;
  capped_count: number;
  skipped_count: number;
  carbon_count: number;
  silica_count: number;
  germination_count: number;
  is_mine: boolean;
}

/** Flow Key tap state for a session (GET /api/mythic/sessions/:id/flow-key). */
export interface FlowKeyState {
  is_open: boolean;
  opened_at: string | null;
  turns_count: number;
  spore_id: string | null;
  capped: number;
  skipped: number;
}

export interface RitualPlaybackState {
  session_id: string;
  current_asset_id: string | null;
  playback_status: 'paused' | 'playing';
  anchor_position: number;
  anchor_timestamp: string;
  revision: number;
  agent_enabled: boolean;
  agent_budget_remaining: number;
}

export interface RitualMessage {
  id: string;
  sender_id: string;
  body: string;
  channel: 'audience' | 'creators';
  created_at: string;
  profiles?: { username?: string; display_name?: string; avatar_url?: string | null };
}

export interface RitualVote {
  id: string;
  prompt: string;
  options: string[];
  status: 'open' | 'closed';
  selected_option: string | null;
  actor_type: 'profile' | 'agent';
}

export interface RitualSnapshot {
  session: {
    id: string;
    title: string;
    description: string | null;
    owner_id: string;
    status: string;
    is_public: boolean;
  };
  role: RitualRole;
  assets: RitualAsset[];
  state: RitualPlaybackState;
  messages: RitualMessage[];
  votes: RitualVote[];
  events: Array<{
    id: string;
    actor_type: 'profile' | 'agent' | 'system';
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
}

export async function ritualRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Ritual request failed');
  return body as T;
}

export function synchronizedPosition(state: RitualPlaybackState): number {
  if (state.playback_status !== 'playing') return Number(state.anchor_position);
  const elapsed = Math.max(0, (Date.now() - new Date(state.anchor_timestamp).getTime()) / 1000);
  return Number(state.anchor_position) + elapsed;
}
