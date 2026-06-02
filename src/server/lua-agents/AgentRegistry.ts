import type { AgentConfig, AgentId } from './agent.types';
import {
  PROFILE_COACH,
  GRANT_ASSISTANT,
  OPPORTUNITY_MATCH,
  MODERATION,
  PRESS_KIT,
  DJ_SET_ANALYZER,
  SCENE_RADAR,
  NOTIFICATION_PRIORITIZER,
  RELEASE_STRATEGY,
  BOOKING_SCOUT,
  COLLABORATION_MATCH,
  FAN_INSIGHTS,
  EVENT_ORGANIZER,
  VENUE_FIT,
  TREND_INTELLIGENCE,
  LABEL_SCOUT,
  VISUAL_IDENTITY,
  COMMUNITY_MANAGER,
  STUB,
  MYTHIC_SCENE_ORBIT,
  MYTHIC_COLLAB_WEAVER,
  MYTHIC_NARRATOR,
  MYTHIC_YIELD_ANALYST,
  MYTHIC_STRATEGIST,
} from './scripts';

const SCRIPT_MAP: Partial<Record<AgentId, string>> = {
  profile_coach: PROFILE_COACH,
  grant_assistant: GRANT_ASSISTANT,
  opportunity_match: OPPORTUNITY_MATCH,
  moderation: MODERATION,
  press_kit: PRESS_KIT,
  dj_set_analyzer: DJ_SET_ANALYZER,
  scene_radar: SCENE_RADAR,
  notification_prioritizer: NOTIFICATION_PRIORITIZER,
  release_strategy: RELEASE_STRATEGY,
  booking_scout: BOOKING_SCOUT,
  collaboration_match: COLLABORATION_MATCH,
  fan_insights: FAN_INSIGHTS,
  event_organizer: EVENT_ORGANIZER,
  venue_fit: VENUE_FIT,
  trend_intelligence: TREND_INTELLIGENCE,
  label_scout: LABEL_SCOUT,
  visual_identity: VISUAL_IDENTITY,
  community_manager: COMMUNITY_MANAGER,
  // Mythic Strategic Agents
  mythic_scene_orbit: MYTHIC_SCENE_ORBIT,
  mythic_collab_weaver: MYTHIC_COLLAB_WEAVER,
  mythic_narrator: MYTHIC_NARRATOR,
  mythic_yield_analyst: MYTHIC_YIELD_ANALYST,
  mythic_strategist: MYTHIC_STRATEGIST,
};

function loadScript(agentId: AgentId): string {
  return SCRIPT_MAP[agentId] ?? STUB;
}

type AgentMeta = {
  display_name: string;
  description: string;
  tier: AgentConfig['tier'];
  approval: AgentConfig['approval_policy'];
  timeout_ms: number;
  tools: string[];
};

const AGENT_META: Record<AgentId, AgentMeta> = {
  profile_coach: {
    display_name: 'Profile Coach',
    description: 'Scores and improves creator profile readiness.',
    tier: 'free',
    approval: 'on_action',
    timeout_ms: 25000,
    tools: ['db.read_one', 'db.read', 'db.upsert', 'audio.features', 'llm.call', 'llm.json'],
  },
  release_strategy: {
    display_name: 'Release Strategy',
    description: 'Plans release timing and campaign next steps.',
    tier: 'pro',
    approval: 'always',
    timeout_ms: 30000,
    tools: ['db.read_one', 'db.read', 'llm.call', 'llm.json', 'vector.embed', 'vector.search'],
  },
  booking_scout: {
    display_name: 'Booking Scout',
    description: 'Finds venue and gig fits with reviewed outreach drafts.',
    tier: 'free',
    approval: 'on_action',
    timeout_ms: 30000,
    tools: ['db.read_one', 'db.read', 'db.rpc', 'vector.embed', 'vector.search', 'llm.call', 'llm.json', 'mythic.node.find_or_create', 'mythic.edge.create'],
  },
  opportunity_match: {
    display_name: 'Opportunity Match',
    description: 'Ranks grants, gigs, calls, residencies, and festivals.',
    tier: 'free',
    approval: 'auto',
    timeout_ms: 30000,
    tools: ['db.read_one', 'db.read', 'db.rpc', 'vector.embed', 'vector.search', 'llm.call', 'llm.json'],
  },
  collaboration_match: {
    display_name: 'Collaboration Match',
    description: 'Finds complementary collaborators and intro drafts.',
    tier: 'free',
    approval: 'on_action',
    timeout_ms: 30000,
    tools: ['db.read_one', 'db.read', 'vector.embed', 'vector.search', 'llm.call', 'llm.json', 'mythic.node.find_or_create', 'mythic.edge.create'],
  },
  scene_radar: {
    display_name: 'Scene Radar',
    description: 'Summarizes aggregate movement in local underground scenes.',
    tier: 'free',
    approval: 'auto',
    timeout_ms: 20000,
    tools: ['db.read_one', 'db.read', 'llm.call'],
  },
  fan_insights: {
    display_name: 'Fan Insights',
    description: 'Clusters audience and engagement signals.',
    tier: 'pro',
    approval: 'auto',
    timeout_ms: 30000,
    tools: ['db.read_one', 'db.read', 'llm.call', 'llm.json', 'vector.embed'],
  },
  event_organizer: {
    display_name: 'Event Organizer',
    description: 'Helps partners assemble lineups and event plans.',
    tier: 'partner',
    approval: 'always',
    timeout_ms: 30000,
    tools: ['db.read', 'db.insert', 'vector.embed', 'vector.search', 'llm.call', 'llm.json', 'mythic.node.find_or_create', 'mythic.edge.create'],
  },
  venue_fit: {
    display_name: 'Venue Fit',
    description: 'Scores artist-to-venue compatibility.',
    tier: 'pro',
    approval: 'auto',
    timeout_ms: 20000,
    tools: ['db.read_one', 'db.read', 'db.rpc', 'vector.embed', 'vector.search', 'llm.call'],
  },
  press_kit: {
    display_name: 'Press Kit',
    description: 'Generates a reviewable one-page EPK draft.',
    tier: 'free',
    approval: 'always',
    timeout_ms: 30000,
    tools: ['db.read_one', 'db.read', 'db.upsert', 'llm.call', 'llm.json'],
  },
  grant_assistant: {
    display_name: 'Grant Assistant',
    description: 'Scores funding fit and drafts applications.',
    tier: 'free',
    approval: 'always',
    timeout_ms: 30000,
    tools: ['db.read_one', 'db.read', 'llm.call', 'llm.json'],
  },
  moderation: {
    display_name: 'Moderation',
    description: 'Flags spam, abuse, fraud, and severe harm.',
    tier: 'free',
    approval: 'on_action',
    timeout_ms: 15000,
    tools: ['db.read_one', 'db.update', 'db.insert', 'llm.call', 'llm.json'],
  },
  trend_intelligence: {
    display_name: 'Trend Intelligence',
    description: 'Builds aggregate trend reports.',
    tier: 'free',
    approval: 'auto',
    timeout_ms: 45000,
    tools: ['db.read', 'db.upsert', 'llm.call', 'llm.json'],
  },
  label_scout: {
    display_name: 'Label Scout',
    description: 'Finds labels and collectives that fit an artist.',
    tier: 'pro',
    approval: 'on_action',
    timeout_ms: 30000,
    tools: ['db.read_one', 'db.read', 'vector.embed', 'vector.search', 'llm.call', 'llm.json'],
  },
  visual_identity: {
    display_name: 'Visual Identity',
    description: 'Creates coherent visual identity briefs.',
    tier: 'pro',
    approval: 'always',
    timeout_ms: 20000,
    tools: ['db.read_one', 'db.read', 'llm.call', 'llm.json'],
  },
  dj_set_analyzer: {
    display_name: 'DJ Set Analyzer',
    description: 'Turns audio features and tracklists into set intelligence.',
    tier: 'pro',
    approval: 'auto',
    timeout_ms: 45000,
    tools: [
      'db.read_one',
      'db.read',
      'db.update',
      'audio.features',
      'audio.tracklist',
      'audio.trigger_analysis',
      'llm.call',
      'llm.json',
    ],
  },
  community_manager: {
    display_name: 'Community Manager',
    description: 'Drafts reviewed replies and community prompts.',
    tier: 'free',
    approval: 'on_action',
    timeout_ms: 20000,
    tools: ['db.read_one', 'db.read', 'llm.call', 'llm.json'],
  },
  notification_prioritizer: {
    display_name: 'Notification Prioritizer',
    description: 'Ranks notifications into daily focus.',
    tier: 'free',
    approval: 'auto',
    timeout_ms: 15000,
    tools: ['db.read', 'llm.call', 'llm.json'],
  },

  // Mythic Strategic Agents (Phase 6)
  mythic_scene_orbit: {
    display_name: 'Mythic Scene Orbit',
    description: 'Maintains career quests and proposes high-yield scene actions using the MythicNode graph.',
    tier: 'pro',
    approval: 'always',
    timeout_ms: 45000,
    tools: ['db.read_one', 'db.read', 'llm.call', 'llm.json', 'mythic.quest.get_active', 'mythic.graph.query'],
  },
  mythic_collab_weaver: {
    display_name: 'Mythic Collab Weaver',
    description: 'Identifies high-yield collaboration opportunities with provenance and historical conversion signals.',
    tier: 'pro',
    approval: 'always',
    timeout_ms: 45000,
    tools: ['db.read_one', 'db.read', 'llm.call', 'llm.json', 'mythic.graph.query'],
  },
  mythic_narrator: {
    display_name: 'Mythic Narrator',
    description: 'Writes living, graph-grounded career narrative chapters.',
    tier: 'pro',
    approval: 'on_action',
    timeout_ms: 30000,
    tools: ['db.read_one', 'llm.call', 'mythic.graph.query'],
  },
  mythic_yield_analyst: {
    display_name: 'Mythic Yield Analyst',
    description: 'Surfaces which of your actions actually produced real career outcomes.',
    tier: 'pro',
    approval: 'always',
    timeout_ms: 40000,
    tools: ['db.read_one', 'db.read', 'llm.json', 'mythic.yield.get_summary', 'mythic.graph.query'],
  },
  mythic_strategist: {
    display_name: 'Mythic Strategist',
    description: 'Weekly strategy pass: 3 collab targets, 3 venue approaches, 2 content ideas from the MythicNode graph.',
    tier: 'free',
    approval: 'on_action',
    timeout_ms: 45000,
    tools: ['db.read_one', 'db.read', 'llm.call', 'llm.json', 'mythic.graph.query', 'mythic.quest.get_active', 'mythic.edge.create'],
  },
};

const now = new Date().toISOString();

// Cache loaded configs so readFileSync only runs once per process.
// Exported so admin promote/rollback routes can invalidate a specific entry.
export const _cache = new Map<AgentId, AgentConfig>();

export async function loadAgentConfig(agentId: AgentId): Promise<AgentConfig> {
  if (_cache.has(agentId)) return _cache.get(agentId)!;

  const meta = AGENT_META[agentId];
  const config: AgentConfig = {
    id: agentId,
    display_name: meta.display_name,
    description: meta.description,
    tier: meta.tier,
    lua_script: loadScript(agentId),
    lua_script_version: 1,
    tools_whitelist: meta.tools,
    approval_policy: meta.approval,
    timeout_ms: meta.timeout_ms,
    max_tokens_per_run: 4096,
    enabled: true,
    created_at: now,
    updated_at: now,
  };

  _cache.set(agentId, config);
  return config;
}
