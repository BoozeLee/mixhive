import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { acquireEngine, releaseEngine } from './LuaRuntime';
import { installSandbox, resetSandboxState } from './LuaSandbox';
import { buildToolCatalogue } from './ToolBridge';
import { loadAgentConfig } from './AgentRegistry';
import type { AgentInput, AgentOutput } from './agent.types';

let _sb: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (!_sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _sb = createClient(url, key, { auth: { persistSession: false } });
  }
  return _sb;
}

const PRIORITY_MAP: Record<string, number> = { low: 1, medium: 3, high: 5 };

function persistRun(output: AgentOutput, input: AgentInput): void {
  if (input.dry_run) return;
  const sb = serviceClient();
  if (!sb) return;

  Promise.resolve()
    .then(async () => {
      await sb.from('agent_runs').insert({
        id: output.run_id,
        agent_id: output.agent_id,
        profile_id: output.profile_id,
        trigger: input.trigger,
        status: output.status,
        duration_ms: output.duration_ms,
        tokens_used: 0,
        error: output.error ?? null,
      });

      for (const s of output.suggestions) {
        await sb.from('ai_suggestions').insert({
          owner_id: output.profile_id,
          suggestion_type: s.type,
          payload: s.payload,
          rationale: s.rationale,
          confidence: s.confidence,
          status: 'pending',
          source: 'claude',
          model: output.agent_id,
        });
      }

      for (const t of output.tasks) {
        await sb.from('creator_tasks').insert({
          owner_id: output.profile_id,
          title: t.title,
          task_type: 'agent_task',
          priority: PRIORITY_MAP[t.priority] ?? 3,
          status: 'open',
          linked_entity_type: 'agent',
        });
      }

      for (const n of output.notifications) {
        await sb.from('notifications').insert({
          user_id: output.profile_id,
          type: 'agent_notification',
          data: {
            agent_id: output.agent_id,
            subject: n.subject,
            body: n.body,
            channel: n.channel,
            cta_url: n.cta_url,
          },
        });
      }
    })
    .catch(err => console.error('[AgentRunner] persistRun error:', err));
}

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const runId = randomUUID();
  const startMs = Date.now();
  const config = await loadAgentConfig(input.agent_id);

  if (!config.enabled) {
    return makeOutput(input, runId, startMs, {
      status: 'skipped',
      suggestions: [],
      tasks: [],
      notifications: [],
      tokens_used: 0,
      lua_logs: [],
    });
  }

  const engine = await acquireEngine();
  const state = { logs: [] as string[] };

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
      state
    );

    await engine.doString(config.lua_script);
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
      config.timeout_ms
    );

    const raw = normalizeRawResult(engine.global.get('_result'));
    const status = isOutputStatus(raw.status) ? raw.status : 'ok';

    const output = makeOutput(input, runId, startMs, {
      status,
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
      tokens_used: 0,
      lua_logs: state.logs,
      error: typeof raw.message === 'string' ? raw.message : undefined,
    });
    persistRun(output, input);
    return output;
  } catch (error) {
    const output = makeOutput(input, runId, startMs, {
      status: 'error',
      suggestions: [],
      tasks: [],
      notifications: [],
      tokens_used: 0,
      lua_logs: state.logs,
      error: error instanceof Error ? error.message : String(error),
    });
    persistRun(output, input);
    return output;
  } finally {
    await resetSandboxState(engine);
    releaseEngine(engine);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms);
    }),
  ]);
}

function normalizeRawResult(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function isOutputStatus(status: unknown): status is AgentOutput['status'] {
  return (
    status === 'ok' || status === 'needs_approval' || status === 'error' || status === 'skipped'
  );
}

type OutputPartial = Omit<AgentOutput, 'agent_id' | 'profile_id' | 'run_id' | 'duration_ms'>;

function makeOutput(
  input: AgentInput,
  runId: string,
  startMs: number,
  partial: OutputPartial
): AgentOutput {
  return {
    agent_id: input.agent_id,
    profile_id: input.profile_id,
    run_id: runId,
    duration_ms: Date.now() - startMs,
    ...partial,
  };
}
