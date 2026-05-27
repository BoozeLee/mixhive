import { randomUUID } from 'crypto'
import { acquireEngine, releaseEngine } from './LuaRuntime'
import { installSandbox, resetSandboxState } from './LuaSandbox'
import { buildToolCatalogue } from './ToolBridge'
import { loadAgentConfig } from './AgentRegistry'
import type { AgentInput, AgentOutput } from './agent.types'

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const runId = randomUUID()
  const startMs = Date.now()
  const config = await loadAgentConfig(input.agent_id)

  if (!config.enabled) {
    return makeOutput(input, runId, startMs, {
      status: 'skipped',
      suggestions: [],
      tasks: [],
      notifications: [],
      tokens_used: 0,
      lua_logs: [],
    })
  }

  const engine = await acquireEngine()
  const state = { logs: [] as string[] }

  try {
    await installSandbox(
      engine,
      buildToolCatalogue(config),
      {
        profile_id: input.profile_id,
        agent_id: input.agent_id,
        run_id: runId,
        trigger: input.trigger,
        dry_run: input.dry_run ?? false,
        context: input.context,
      },
      config,
      state,
    )

    await engine.doString(config.lua_script)
    await withTimeout(
      engine.doString(`
        local ok_status, raw = pcall(run, ctx)
        if not ok_status then
          _result = {
            status = "error",
            message = tostring(raw),
            suggestions = {},
            tasks = {},
            notifications = {}
          }
        else
          _result = raw
        end
      `),
      config.timeout_ms,
    )

    const raw = normalizeRawResult(engine.global.get('_result'))
    const status = isOutputStatus(raw.status) ? raw.status : 'ok'

    return makeOutput(input, runId, startMs, {
      status,
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
      tokens_used: 0,
      lua_logs: state.logs,
      error: typeof raw.message === 'string' ? raw.message : undefined,
    })
  } catch (error) {
    return makeOutput(input, runId, startMs, {
      status: 'error',
      suggestions: [],
      tasks: [],
      notifications: [],
      tokens_used: 0,
      lua_logs: state.logs,
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    await resetSandboxState(engine)
    releaseEngine(engine)
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms)
    }),
  ])
}

function normalizeRawResult(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

function isOutputStatus(status: unknown): status is AgentOutput['status'] {
  return status === 'ok' || status === 'needs_approval' || status === 'error' || status === 'skipped'
}

type OutputPartial = Omit<AgentOutput, 'agent_id' | 'profile_id' | 'run_id' | 'duration_ms'>

function makeOutput(
  input: AgentInput,
  runId: string,
  startMs: number,
  partial: OutputPartial,
): AgentOutput {
  return {
    agent_id: input.agent_id,
    profile_id: input.profile_id,
    run_id: runId,
    duration_ms: Date.now() - startMs,
    ...partial,
  }
}
