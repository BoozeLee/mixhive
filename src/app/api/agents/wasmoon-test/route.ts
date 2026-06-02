import { NextResponse } from 'next/server';
import { getPoolStats } from '../../../../server/lua-agents/LuaRuntime';
import { runAgent } from '../../../../server/lua-agents/AgentRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const output = await runAgent({
    agent_id: 'profile_coach',
    profile_id: 'runtime-probe',
    trigger: 'event:user_request',
    dry_run: true,
  });

  return NextResponse.json({
    ok: output.status === 'ok',
    engine: 'wasmoon',
    output,
    pool: getPoolStats(),
  });
}
