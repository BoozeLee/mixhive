// Tests for AgentRegistry — validates all 23 agents have correct metadata,
// tools whitelists are valid, and loadAgentConfig returns expected shape.

import { loadAgentConfig, _cache } from '@/server/lua-agents/AgentRegistry';
import type { AgentId } from '@/server/lua-agents/agent.types';

const ALL_AGENT_IDS: AgentId[] = [
  'profile_coach',
  'release_strategy',
  'booking_scout',
  'opportunity_match',
  'collaboration_match',
  'scene_radar',
  'fan_insights',
  'event_organizer',
  'venue_fit',
  'press_kit',
  'grant_assistant',
  'moderation',
  'trend_intelligence',
  'label_scout',
  'visual_identity',
  'dj_set_analyzer',
  'community_manager',
  'notification_prioritizer',
  'mythic_scene_orbit',
  'mythic_collab_weaver',
  'mythic_narrator',
  'mythic_yield_analyst',
];

const VALID_TIERS = new Set(['free', 'pro', 'partner']);
const VALID_APPROVAL = new Set(['auto', 'always', 'on_action']);
const KNOWN_TOOLS = new Set([
  'db.read',
  'db.read_one',
  'db.insert',
  'db.upsert',
  'db.update',
  'db.rpc',
  'llm.call',
  'llm.json',
  'vector.embed',
  'vector.search',
  'vector.upsert',
  'audio.features',
  'audio.tracklist',
  'audio.trigger_analysis',
  'http.get',
  'http.post',
  'mythic.quest.get_active',
  'mythic.graph.query',
  'mythic.yield.get_summary',
  'mythic.node.find_or_create',
  'mythic.edge.create',
  'runtime.allowed_tools',
]);

beforeEach(() => {
  _cache.clear();
});

describe('AgentRegistry', () => {
  it.each(ALL_AGENT_IDS)('loadAgentConfig("%s") returns valid shape', async id => {
    const config = await loadAgentConfig(id);

    expect(config.id).toBe(id);
    expect(typeof config.display_name).toBe('string');
    expect(config.display_name.length).toBeGreaterThan(0);

    expect(VALID_TIERS.has(config.tier)).toBe(true);
    expect(VALID_APPROVAL.has(config.approval_policy)).toBe(true);

    expect(config.timeout_ms).toBeGreaterThanOrEqual(1000);
    expect(config.timeout_ms).toBeLessThanOrEqual(120000);

    expect(config.enabled).toBe(true);
    expect(typeof config.lua_script).toBe('string');
    expect(config.lua_script.length).toBeGreaterThan(10);

    expect(Array.isArray(config.tools_whitelist)).toBe(true);
    for (const tool of config.tools_whitelist) {
      expect(KNOWN_TOOLS.has(tool)).toBe(true);
    }
  });

  it('caches config after first load', async () => {
    const first = await loadAgentConfig('profile_coach');
    const second = await loadAgentConfig('profile_coach');
    expect(first).toBe(second);
  });

  it('all agents have non-empty lua_script', async () => {
    for (const id of ALL_AGENT_IDS) {
      _cache.clear();
      const cfg = await loadAgentConfig(id);
      expect(cfg.lua_script.trim().length).toBeGreaterThan(0);
    }
  });

  it('mythic agents use pro tier', async () => {
    const mythicIds = ALL_AGENT_IDS.filter(id => id.startsWith('mythic_'));
    for (const id of mythicIds) {
      _cache.clear();
      const cfg = await loadAgentConfig(id);
      expect(cfg.tier).toBe('pro');
    }
  });

  it('booking_scout includes db.rpc', async () => {
    const cfg = await loadAgentConfig('booking_scout');
    expect(cfg.tools_whitelist).toContain('db.rpc');
  });

  it('venue_fit includes db.rpc', async () => {
    const cfg = await loadAgentConfig('venue_fit');
    expect(cfg.tools_whitelist).toContain('db.rpc');
  });
});
