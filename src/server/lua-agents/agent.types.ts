export type AgentId =
  | 'profile_coach'
  | 'release_strategy'
  | 'booking_scout'
  | 'opportunity_match'
  | 'collaboration_match'
  | 'scene_radar'
  | 'fan_insights'
  | 'event_organizer'
  | 'venue_fit'
  | 'press_kit'
  | 'grant_assistant'
  | 'moderation'
  | 'trend_intelligence'
  | 'label_scout'
  | 'visual_identity'
  | 'dj_set_analyzer'
  | 'community_manager'
  | 'notification_prioritizer'

export type AgentTier = 'free' | 'pro' | 'partner'
export type ApprovalPolicy = 'auto' | 'always' | 'on_action'

export interface AgentConfig {
  id: AgentId
  display_name: string
  description: string
  tier: AgentTier
  lua_script: string
  lua_script_version: number
  tools_whitelist: string[]
  approval_policy: ApprovalPolicy
  timeout_ms: number
  max_tokens_per_run: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface AgentInput {
  agent_id: AgentId
  profile_id: string
  trigger: AgentTrigger
  context?: Record<string, unknown>
  dry_run?: boolean
}

export type AgentTrigger =
  | 'cron:hourly'
  | 'cron:daily'
  | 'cron:weekly'
  | 'event:mix_uploaded'
  | 'event:profile_updated'
  | 'event:opportunity_added'
  | 'event:user_request'
  | 'event:follow'
  | 'event:message'

export interface AgentOutput {
  agent_id: AgentId
  profile_id: string
  run_id: string
  status: 'ok' | 'needs_approval' | 'error' | 'skipped'
  suggestions: AgentSuggestion[]
  tasks: AgentTask[]
  notifications: AgentNotification[]
  tokens_used: number
  duration_ms: number
  lua_logs: string[]
  error?: string
}

export interface AgentSuggestion {
  type: string
  payload: Record<string, unknown>
  confidence: number
  rationale: string
  requires_approval: boolean
}

export interface AgentTask {
  title: string
  due_date?: string | undefined
  priority: 'low' | 'medium' | 'high'
  agent_id: AgentId
}

export interface AgentNotification {
  channel: 'in_app' | 'email' | 'push'
  subject: string
  body: string
  cta_url?: string | undefined
}

export interface ToolCatalogue {
  [toolName: string]: (...args: unknown[]) => Promise<unknown> | unknown
}

export interface LuaSandboxContext {
  profile_id: string
  agent_id: AgentId
  run_id: string
  trigger: AgentTrigger
  dry_run: boolean
  context?: Record<string, unknown>
}
