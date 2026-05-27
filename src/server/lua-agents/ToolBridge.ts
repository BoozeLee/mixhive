import type { AgentConfig, AgentNotification, AgentSuggestion, AgentTask, ToolCatalogue } from './agent.types'
import { dbTools } from './tools/db'
import { llmTools } from './tools/llm'
import { vectorTools } from './tools/vector'
import { audioTools } from './tools/audio'
import { httpTools } from './tools/http'

export interface BridgeState {
  logs: string[]
}

const MASTER: ToolCatalogue = {
  ...dbTools,
  ...llmTools,
  ...vectorTools,
  ...audioTools,
  ...httpTools,
}

export function buildToolCatalogue(config: AgentConfig): ToolCatalogue {
  const allowed = new Set(config.tools_whitelist)
  const catalogue: ToolCatalogue = {}

  for (const name of allowed) {
    const fn = MASTER[name]
    if (fn) {
      catalogue[name] = fn
    } else if (name !== 'runtime.allowed_tools') {
      console.warn(`[ToolBridge] unknown tool "${name}" for agent ${config.id}`)
    }
  }

  return catalogue
}

export function buildRuntimeHelpers(config: AgentConfig, state: BridgeState) {
  return {
    mh_log: (...parts: unknown[]) => {
      state.logs.push(parts.map(String).join(' '))
      return true
    },
    mh_get_logs: () => state.logs,
    suggestion: (
      type: string,
      payload: Record<string, unknown> = {},
      confidence = 0,
      rationale = '',
      requiresApproval = config.approval_policy === 'always',
    ): AgentSuggestion => ({
      type,
      payload,
      confidence: clampConfidence(confidence),
      rationale,
      requires_approval: Boolean(requiresApproval),
    }),
    task: (title: string, priority: AgentTask['priority'] = 'medium', dueDate?: string): AgentTask => ({
      title,
      priority,
      due_date: dueDate,
      agent_id: config.id,
    }),
    notify: (
      subject: string,
      body: string,
      channel: AgentNotification['channel'] = 'in_app',
      ctaUrl?: string,
    ): AgentNotification => ({
      subject,
      body,
      channel,
      cta_url: ctaUrl,
    }),
  }
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}
