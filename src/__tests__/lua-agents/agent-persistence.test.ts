// Verifies that runAgent() fires the persistence pipeline (agent_runs,
// ai_suggestions, creator_tasks, notifications) on non-dry-run, and skips all
// inserts on dry_run=true.

const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = jest.fn(() => ({ insert: mockInsert }));
const mockRpc = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Stub the wasmoon engine so we don't need a real Lua runtime in tests
jest.mock('@/server/lua-agents/LuaRuntime', () => ({
  acquireEngine: jest.fn(async () => mockEngine),
  releaseEngine: jest.fn(),
}));

jest.mock('@/server/lua-agents/LuaSandbox', () => ({
  installSandbox: jest.fn(async () => undefined),
  resetSandboxState: jest.fn(async () => undefined),
}));

jest.mock('@/server/lua-agents/ToolBridge', () => ({
  buildToolCatalogue: jest.fn(() => ({})),
}));

jest.mock('@/server/lua-agents/AgentRegistry', () => ({
  loadAgentConfig: jest.fn(async () => ({
    id: 'profile_coach',
    enabled: true,
    lua_script: '',
    lua_script_version: 1,
    tools_whitelist: [],
    approval_policy: 'auto',
    timeout_ms: 5000,
    max_tokens_per_run: 4096,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
}));

const mockGlobal = { get: jest.fn() };
const mockEngine = {
  doString: jest.fn(async () => undefined),
  global: mockGlobal,
};

let runAgent: typeof import('@/server/lua-agents/AgentRunner').runAgent;

beforeAll(async () => {
  const mod = await import('@/server/lua-agents/AgentRunner');
  runAgent = mod.runAgent;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ data: null, error: null });
  mockFrom.mockReturnValue({ insert: mockInsert });
});

function setupLuaResult(overrides: Record<string, unknown> = {}) {
  mockGlobal.get.mockReturnValue({
    status: 'ok',
    suggestions: [
      {
        type: 'profile_tip',
        payload: { bio: 'test' },
        confidence: 0.8,
        rationale: 'add bio',
        requires_approval: false,
      },
    ],
    tasks: [{ title: 'Update bio', priority: 'medium' }],
    notifications: [
      { channel: 'in_app', subject: 'Tip', body: 'Update your bio', cta_url: '/profile' },
    ],
    ...overrides,
  });
}

describe('persistRun on non-dry-run', () => {
  it('inserts agent_runs row', async () => {
    setupLuaResult();
    await runAgent({
      agent_id: 'profile_coach',
      profile_id: 'user-1',
      trigger: 'event:user_request',
      dry_run: false,
    });
    // Give fire-and-forget a tick to resolve
    await new Promise(r => setTimeout(r, 20));

    const calledTables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(calledTables).toContain('agent_runs');
  });

  it('inserts ai_suggestions for each suggestion', async () => {
    setupLuaResult();
    await runAgent({
      agent_id: 'profile_coach',
      profile_id: 'user-1',
      trigger: 'event:user_request',
      dry_run: false,
    });
    await new Promise(r => setTimeout(r, 20));

    const calledTables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(calledTables).toContain('ai_suggestions');
  });

  it('inserts creator_tasks for each task', async () => {
    setupLuaResult();
    await runAgent({
      agent_id: 'profile_coach',
      profile_id: 'user-1',
      trigger: 'event:user_request',
      dry_run: false,
    });
    await new Promise(r => setTimeout(r, 20));

    const calledTables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(calledTables).toContain('creator_tasks');
  });

  it('inserts notifications for each notification', async () => {
    setupLuaResult();
    await runAgent({
      agent_id: 'profile_coach',
      profile_id: 'user-1',
      trigger: 'event:user_request',
      dry_run: false,
    });
    await new Promise(r => setTimeout(r, 20));

    const calledTables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(calledTables).toContain('notifications');
  });
});

describe('persistRun on dry_run=true', () => {
  it('skips all DB inserts', async () => {
    setupLuaResult();
    await runAgent({
      agent_id: 'profile_coach',
      profile_id: 'user-1',
      trigger: 'event:user_request',
      dry_run: true,
    });
    await new Promise(r => setTimeout(r, 20));

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('persistRun on error output', () => {
  it('still inserts agent_runs even on Lua error', async () => {
    mockGlobal.get.mockReturnValue({
      status: 'error',
      message: 'boom',
      suggestions: [],
      tasks: [],
      notifications: [],
    });
    await runAgent({
      agent_id: 'profile_coach',
      profile_id: 'user-1',
      trigger: 'event:user_request',
      dry_run: false,
    });
    await new Promise(r => setTimeout(r, 20));

    const calledTables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(calledTables).toContain('agent_runs');
  });
});
