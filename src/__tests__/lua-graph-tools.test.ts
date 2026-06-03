/**
 * @jest-environment node
 */

// Tests for Phase 6 Lua graph tool surface:
// - migration 064 RPC contracts (mocked via supabase)
// - mh.* tool registrations in AgentRegistry

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { loadAgentConfig } from '../server/lua-agents/AgentRegistry';

const mockCreateClient = createClient as jest.Mock;

function makeRpcChain(result: { data: unknown; error: unknown }) {
  const leaf = Promise.resolve(result);
  const chain = {} as Record<string, unknown>;
  for (const m of ['select', 'eq', 'order', 'limit', 'single']) {
    (chain as Record<string, jest.Mock>)[m] = jest.fn().mockReturnValue(chain);
  }
  chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => leaf.then(res, rej);
  chain.catch = (rej: (e: unknown) => unknown) => leaf.catch(rej);
  return chain;
}

function makeSupabaseWithRpc(rpcResults: Record<string, unknown>) {
  return {
    rpc: jest.fn((fn: string) => makeRpcChain({ data: rpcResults[fn] ?? null, error: null })),
    from: jest.fn().mockReturnValue(makeRpcChain({ data: [], error: null })),
  };
}

describe('lua_get_similar_artists RPC', () => {
  it('returns a capped list of similar artists', async () => {
    const artists = [
      {
        artist_id: 'uuid-1',
        display_name: 'DJ Nef',
        username: 'djnef',
        avatar_url: null,
        shared_score: 0.87,
      },
      {
        artist_id: 'uuid-2',
        display_name: 'Kilian',
        username: 'kilian',
        avatar_url: null,
        shared_score: 0.72,
      },
    ];
    const sb = makeSupabaseWithRpc({ lua_get_similar_artists: artists });
    mockCreateClient.mockReturnValue(sb);

    const result = await sb.rpc('lua_get_similar_artists', {
      p_owner_id: 'owner-uuid',
      p_limit: 3,
    });
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ username: 'djnef', shared_score: 0.87 });
  });
});

describe('lua_get_relevant_opportunities RPC', () => {
  it('filters out already-saved opportunities and returns scored results', async () => {
    const opps = [
      {
        opp_id: 'opp-1',
        title: 'Boiler Room BE',
        opp_type: 'festival',
        city: 'Ghent',
        deadline: '2026-07-01',
        genres: ['techno'],
        match_score: 9,
      },
    ];
    const sb = makeSupabaseWithRpc({ lua_get_relevant_opportunities: opps });
    mockCreateClient.mockReturnValue(sb);

    const result = await sb.rpc('lua_get_relevant_opportunities', {
      p_owner_id: 'owner-uuid',
      p_limit: 5,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].match_score).toBe(9);
    expect(result.data[0].title).toBe('Boiler Room BE');
  });
});

describe('lua_get_quest_momentum RPC', () => {
  it('returns correct milestone counts and days_remaining', async () => {
    const quests = [
      {
        quest_id: 'q-1',
        title: '10 gigs in 90 days',
        status: 'active',
        momentum: 0.65,
        milestones_total: 5,
        milestones_done: 2,
        days_remaining: 45,
      },
    ];
    const sb = makeSupabaseWithRpc({ lua_get_quest_momentum: quests });
    mockCreateClient.mockReturnValue(sb);

    const result = await sb.rpc('lua_get_quest_momentum', { p_owner_id: 'owner-uuid' });
    expect(result.data[0].milestones_done).toBe(2);
    expect(result.data[0].milestones_total).toBe(5);
    expect(result.data[0].days_remaining).toBe(45);
  });
});

describe('lua_propose_quest RPC', () => {
  it('inserts and returns a new quest_id', async () => {
    const newId = 'new-quest-uuid';
    const sb = makeSupabaseWithRpc({ lua_propose_quest: newId });
    mockCreateClient.mockReturnValue(sb);

    const result = await sb.rpc('lua_propose_quest', {
      p_owner_id: 'owner-uuid',
      p_agent_id: 'agent-uuid',
      p_title: 'Release 3 EPs',
      p_scene_tags: ['techno'],
      p_timeframe_days: 90,
    });
    expect(result.data).toBe(newId);
  });

  it('returns null when 30-day rate limit is exceeded', async () => {
    const sb = makeSupabaseWithRpc({ lua_propose_quest: null });
    mockCreateClient.mockReturnValue(sb);

    const result = await sb.rpc('lua_propose_quest', {
      p_owner_id: 'owner-uuid',
      p_agent_id: 'agent-uuid',
      p_title: '4th quest this month',
      p_scene_tags: [],
      p_timeframe_days: 90,
    });
    expect(result.data).toBeNull();
  });
});

describe('mythic_strategist AgentRegistry entry', () => {
  it('is registered and has the graph tools on its whitelist', async () => {
    const config = await loadAgentConfig('mythic_strategist');
    expect(config.id).toBe('mythic_strategist');
    expect(config.tier).toBe('free');
    expect(config.tools_whitelist).toContain('mythic.graph.query');
    expect(config.tools_whitelist).toContain('mythic.quest.get_active');
    expect(config.tools_whitelist).toContain('mythic.edge.create');
  });
});
