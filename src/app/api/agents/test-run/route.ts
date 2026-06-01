import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const LUA_RUNTIME_SECRET =
  process.env.LUA_RUNTIME_SHARED_SECRET ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  ''

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  // Validate the user's JWT via Supabase anon client
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: authError } = await sb.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const agentId = body.agent_id
  if (typeof agentId !== 'string') {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
  }

  // Verify ownership — RLS will reject non-owners automatically but we check
  // here too for a clear 404 rather than a silent empty result.
  const { data: agent } = await sb
    .from('lua_agents')
    .select('id')
    .eq('id', agentId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!agent) {
    return NextResponse.json({ error: 'agent not found' }, { status: 404 })
  }

  // Proxy to the Python Lua runtime with the service-role secret
  const runtimeUrl = new URL('/api/lua-agent/run', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
  const runtimeRes = await fetch(runtimeUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LUA_RUNTIME_SECRET}`,
    },
    body: JSON.stringify(body),
  })

  const data = await runtimeRes.json()
  return NextResponse.json(data, { status: runtimeRes.status })
}
