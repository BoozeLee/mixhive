// Persistent agent state tools — backed by lua_agent_states in Supabase.
// Scoped per (agent_id, profile_id). Max 256 keys, values ≤ 4096 chars.
// TTL is optional; expired rows are swept by the pg_cron job in migration 054.

import { createClient } from '@supabase/supabase-js';
import type { AgentId } from '../agent.types';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service-role env vars not set');
  return createClient(url, key, { auth: { persistSession: false } });
}

export function buildStateTools(agentId: AgentId, profileId: string) {
  return {
    state_get: async (key: string): Promise<string | null> => {
      if (typeof key !== 'string' || key.length === 0) return null;
      const { data } = await adminClient()
        .from('lua_agent_states')
        .select('state_value, expires_at')
        .eq('agent_id', agentId)
        .eq('profile_id', profileId)
        .eq('state_key', key)
        .maybeSingle();

      if (!data) return null;
      if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
      return data.state_value;
    },

    state_set: async (key: string, value: string, ttlSeconds?: number): Promise<boolean> => {
      if (typeof key !== 'string' || key.length === 0 || key.length > 128) {
        throw new Error('state_set: key must be 1-128 chars');
      }
      if (typeof value !== 'string' || value.length > 4096) {
        throw new Error('state_set: value must be ≤ 4096 chars');
      }

      const expiresAt =
        typeof ttlSeconds === 'number' && ttlSeconds > 0
          ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
          : null;

      const { error } = await adminClient().from('lua_agent_states').upsert(
        {
          agent_id: agentId,
          profile_id: profileId,
          state_key: key,
          state_value: value,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id,profile_id,state_key' }
      );

      if (error) throw new Error(`state_set: ${error.message}`);
      return true;
    },

    state_del: async (key: string): Promise<boolean> => {
      const { error } = await adminClient()
        .from('lua_agent_states')
        .delete()
        .eq('agent_id', agentId)
        .eq('profile_id', profileId)
        .eq('state_key', key);
      if (error) throw new Error(`state_del: ${error.message}`);
      return true;
    },
  };
}
