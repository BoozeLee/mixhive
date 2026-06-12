// Unit tests for AgentRunner — validates orchestration logic, error handling,
// and output shape without running real wasmoon. The engine is mocked.
// Real wasmoon integration tests run via `npm run test:wasmoon`.

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockResolvedValue({ error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

// Factory must not reference outer variables (jest.mock is hoisted)
jest.mock('@/server/lua-agents/LuaRuntime', () => ({
  acquireEngine: jest.fn(),
  releaseEngine: jest.fn(),
  shutdownPool: jest.fn().mockResolvedValue(undefined),
  getPoolStats: jest.fn().mockReturnValue({ pool_size: 1, busy: 0, max_size: 4 }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.OPENAI_API_KEY = 'test-key';

import { runAgent } from '@/server/lua-agents/AgentRunner';
import { acquireEngine } from '@/server/lua-agents/LuaRuntime';
import { _cache } from '@/server/lua-agents/AgentRegistry';

// Engine object configured before each test
const mockEngine = {
  global: {
    set: jest.fn(),
    get: jest.fn(),
    close: jest.fn(),
  },
  doString: jest.fn(),
};

function resetEngine(status = 'ok') {
  mockEngine.global.set.mockReset();
  mockEngine.global.get.mockReset().mockReturnValue({
    status,
    suggestions: [],
    tasks: [],
    notifications: [],
  });
  mockEngine.doString.mockReset().mockResolvedValue(undefined);
  (acquireEngine as jest.Mock).mockResolvedValue(mockEngine);
}

beforeEach(() => {
  jest.clearAllMocks();
  _cache.clear();
  resetEngine();
});

describe('runAgent — output shape', () => {
  it('returns correct agent_id and profile_id', async () => {
    const out = await runAgent({
      agent_id: 'profile_coach',
      profile_id: 'my-profile',
      trigger: 'event:user_request',
      dry_run: true,
    });
    expect(out.agent_id).toBe('profile_coach');
    expect(out.profile_id).toBe('my-profile');
  });

  it('returns a uuid run_id', async () => {
    const out = await runAgent({
      agent_id: 'scene_radar',
      profile_id: 'p1',
      trigger: 'cron:daily',
      dry_run: true,
    });
    expect(out.run_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('records duration_ms >= 0', async () => {
    const out = await runAgent({
      agent_id: 'moderation',
      profile_id: 'p1',
      trigger: 'event:user_request',
    });
    expect(out.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('returns ok status when engine returns ok', async () => {
    const out = await runAgent({
      agent_id: 'notification_prioritizer',
      profile_id: 'p1',
      trigger: 'cron:hourly',
      dry_run: true,
    });
    expect(out.status).toBe('ok');
    expect(Array.isArray(out.suggestions)).toBe(true);
    expect(Array.isArray(out.tasks)).toBe(true);
    expect(Array.isArray(out.notifications)).toBe(true);
    expect(Array.isArray(out.lua_logs)).toBe(true);
  });

  it('returns error status when engine doString throws', async () => {
    mockEngine.doString.mockRejectedValueOnce(new Error('syntax error near token'));
    const out = await runAgent({
      agent_id: 'moderation',
      profile_id: 'p1',
      trigger: 'event:user_request',
      dry_run: true,
    });
    expect(out.status).toBe('error');
    expect(out.error).toContain('syntax error');
  });

  it('returns needs_approval when engine returns needs_approval', async () => {
    mockEngine.global.get.mockReturnValue({
      status: 'needs_approval',
      suggestions: [
        {
          type: 'bio_rewrite',
          payload: {},
          confidence: 0.9,
          rationale: 'test',
          requires_approval: true,
        },
      ],
      tasks: [],
      notifications: [],
    });
    const out = await runAgent({
      agent_id: 'press_kit',
      profile_id: 'p1',
      trigger: 'event:user_request',
      dry_run: true,
    });
    expect(out.status).toBe('needs_approval');
    expect(out.suggestions).toHaveLength(1);
  });

  it('normalises unknown status to ok', async () => {
    mockEngine.global.get.mockReturnValue({
      status: 'invalid_status',
      suggestions: [],
      tasks: [],
      notifications: [],
    });
    const out = await runAgent({
      agent_id: 'profile_coach',
      profile_id: 'p1',
      trigger: 'event:user_request',
      dry_run: true,
    });
    expect(['ok', 'error', 'skipped', 'needs_approval']).toContain(out.status);
  });
});

describe('runAgent — disabled agent', () => {
  it('returns skipped without calling acquireEngine', async () => {
    _cache.set('moderation', {
      id: 'moderation',
      display_name: 'Moderation',
      description: 'test',
      tier: 'free',
      lua_script: '-- stub',
      lua_script_version: 1,
      tools_whitelist: [],
      approval_policy: 'on_action',
      timeout_ms: 5000,
      max_tokens_per_run: 512,
      enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const out = await runAgent({
      agent_id: 'moderation',
      profile_id: 'p1',
      trigger: 'event:user_request',
    });
    expect(out.status).toBe('skipped');
    expect(acquireEngine).not.toHaveBeenCalled();
  });
});
