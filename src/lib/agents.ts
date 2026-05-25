// Client API for the Lua agent layer.
//
// The agents table is owned (RLS-gated) so listing / CRUD goes through
// supabase-js. Test-runs hit our Python serverless function directly,
// authenticated with the user's JWT — the function re-checks ownership.

import { supabase } from './supabase'

export type LuaAgentTrigger =
  | 'on_follow'
  | 'on_unfollow'
  | 'on_mix_upload'
  | 'on_comment'
  | 'on_reply'
  | 'on_mention'
  | 'on_like'
  | 'on_repost'
  | 'on_schedule'
  | 'manual'

export interface LuaAgent {
  id: string
  owner_id: string
  name: string
  description: string | null
  trigger_type: LuaAgentTrigger | null
  cron_expr: string | null
  lua_code: string
  enabled: boolean
  timeout_ms: number
  memory_kb: number
  run_count: number
  error_count: number
  last_run_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface LuaAgentRun {
  id: number
  agent_id: string
  triggered_by: string
  event_payload: Record<string, unknown> | null
  status: 'ok' | 'error' | 'timeout' | 'oom' | 'denied'
  duration_ms: number | null
  stdout: string | null
  error_message: string | null
  created_at: string
}

export async function listAgents(): Promise<LuaAgent[]> {
  const { data, error } = await supabase
    .from('lua_agents')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []) as LuaAgent[]
}

export async function createAgent(input: {
  name: string
  description?: string
  trigger_type: LuaAgentTrigger
  lua_code: string
  enabled?: boolean
  cron_expr?: string
}): Promise<LuaAgent> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('not signed in')
  const { data, error } = await supabase
    .from('lua_agents')
    .insert({
      owner_id: user.user.id,
      name: input.name,
      description: input.description ?? null,
      trigger_type: input.trigger_type,
      lua_code: input.lua_code,
      enabled: input.enabled ?? true,
      cron_expr: input.cron_expr ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as LuaAgent
}

export async function updateAgent(id: string, patch: Partial<LuaAgent>): Promise<LuaAgent> {
  const { data, error } = await supabase
    .from('lua_agents')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as LuaAgent
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from('lua_agents').delete().eq('id', id)
  if (error) throw error
}

export async function listRuns(agentId: string, limit = 25): Promise<LuaAgentRun[]> {
  const { data, error } = await supabase
    .from('lua_agent_runs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as LuaAgentRun[]
}

/** Fire an agent ad-hoc with a custom event payload (the "Test run" button). */
export async function testRunAgent(
  agentId: string,
  event: Record<string, unknown> = {},
): Promise<{ status: string; duration_ms: number; stdout: string[]; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('not signed in')

  const res = await fetch('/api/lua-agent/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The function trusts SUPABASE_SERVICE_ROLE_KEY in production; in
      // dev with the runtime-shared-secret set to the anon key we can
      // pass the user's JWT and let the function still authenticate.
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ agent_id: agentId, triggered_by: 'manual', event }),
  })
  if (!res.ok) throw new Error(`runtime returned ${res.status}`)
  return res.json()
}
