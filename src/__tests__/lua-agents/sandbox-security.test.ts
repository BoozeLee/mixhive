// Sandbox security tests — verifies that installSandbox correctly strips
// dangerous globals and injects the expected safe globals.
// Uses a mocked LuaEngine so no wasmoon WASM binary is needed in CI.
// The real end-to-end sandbox escape tests run via `npm run test:wasmoon`.

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockResolvedValue({ error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

import { installSandbox, resetSandboxState } from '@/server/lua-agents/LuaSandbox';
import { buildToolCatalogue } from '@/server/lua-agents/ToolBridge';
import { loadAgentConfig, _cache } from '@/server/lua-agents/AgentRegistry';

// Mock LuaEngine — capture all global.set and doString calls
type SetCall = { key: string; value: unknown };
let setCalls: SetCall[] = [];
let doStringCalls: string[] = [];

const mockEngine = {
  global: {
    set: jest.fn((key: string, value: unknown) => {
      setCalls.push({ key, value });
    }),
    close: jest.fn(),
    get: jest.fn(),
  },
  doString: jest.fn(async (code: string) => {
    doStringCalls.push(code);
  }),
};

beforeEach(() => {
  setCalls = [];
  doStringCalls = [];
  jest.clearAllMocks();
  _cache.clear();
});

describe('installSandbox — global injection', () => {
  async function install() {
    const config = await loadAgentConfig('profile_coach');
    const state = { logs: [] as string[] };
    await installSandbox(
      mockEngine as never,
      buildToolCatalogue(config),
      {
        profile_id: 'p1',
        agent_id: 'profile_coach',
        run_id: 'r1',
        trigger: 'event:user_request',
        dry_run: true,
      },
      config,
      state
    );
    return state;
  }

  it('injects ctx', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'ctx');
    expect(call).toBeDefined();
    expect((call!.value as Record<string, unknown>).profile_id).toBe('p1');
  });

  it('injects mixhive tool catalogue', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'mixhive');
    expect(call).toBeDefined();
    expect(typeof call!.value).toBe('object');
  });

  it('injects mh_log function', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'mh_log');
    expect(typeof call?.value).toBe('function');
  });

  it('injects suggestion helper', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'suggestion');
    expect(typeof call?.value).toBe('function');
  });

  it('injects task helper', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'task');
    expect(typeof call?.value).toBe('function');
  });

  it('injects notify helper', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'notify');
    expect(typeof call?.value).toBe('function');
  });

  it('injects state_get', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'state_get');
    expect(typeof call?.value).toBe('function');
  });

  it('injects state_set', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'state_set');
    expect(typeof call?.value).toBe('function');
  });

  it('injects state_del', async () => {
    await install();
    const call = setCalls.find(c => c.key === 'state_del');
    expect(typeof call?.value).toBe('function');
  });

  it('strips dangerous globals via doString', async () => {
    await install();
    const stripCall = doStringCalls.find(c => c.includes('debug = nil'));
    expect(stripCall).toBeDefined();
    expect(stripCall).toContain('io = nil');
    expect(stripCall).toContain('os = nil');
    expect(stripCall).toContain('package = nil');
    expect(stripCall).toContain('require = nil');
    expect(stripCall).toContain('collectgarbage = nil');
  });
});

describe('resetSandboxState', () => {
  it('nulls out all sandbox globals', async () => {
    await resetSandboxState(mockEngine as never);
    const resetCall = doStringCalls.find(c => c.includes('ctx = nil'));
    expect(resetCall).toBeDefined();
    expect(resetCall).toContain('mixhive = nil');
    expect(resetCall).toContain('state_get = nil');
    expect(resetCall).toContain('state_set = nil');
    expect(resetCall).toContain('state_del = nil');
    expect(resetCall).toContain('_result = nil');
  });
});

describe('state_get / state_set — function shape', () => {
  it('state_get accepts a string key and returns a Promise', async () => {
    const config = await loadAgentConfig('profile_coach');
    const state = { logs: [] as string[] };
    await installSandbox(
      mockEngine as never,
      buildToolCatalogue(config),
      {
        profile_id: 'p1',
        agent_id: 'profile_coach',
        run_id: 'r1',
        trigger: 'event:user_request',
        dry_run: true,
      },
      config,
      state
    );
    const stateGetCall = setCalls.find(c => c.key === 'state_get');
    const fn = stateGetCall!.value as (k: string) => Promise<string | null>;
    const result = fn('test-key');
    expect(result instanceof Promise).toBe(true);
    // Resolves to null because mocked Supabase returns null
    await expect(result).resolves.toBeNull();
  });

  it('state_set rejects on oversized key', async () => {
    const config = await loadAgentConfig('profile_coach');
    const state = { logs: [] as string[] };
    await installSandbox(
      mockEngine as never,
      buildToolCatalogue(config),
      {
        profile_id: 'p1',
        agent_id: 'profile_coach',
        run_id: 'r1',
        trigger: 'event:user_request',
        dry_run: true,
      },
      config,
      state
    );
    const stateSetCall = setCalls.find(c => c.key === 'state_set');
    const fn = stateSetCall!.value as (k: string, v: string) => Promise<boolean>;
    await expect(fn('k'.repeat(129), 'value')).rejects.toThrow('1-128 chars');
  });

  it('state_set rejects on oversized value', async () => {
    const config = await loadAgentConfig('profile_coach');
    const state = { logs: [] as string[] };
    await installSandbox(
      mockEngine as never,
      buildToolCatalogue(config),
      {
        profile_id: 'p1',
        agent_id: 'profile_coach',
        run_id: 'r1',
        trigger: 'event:user_request',
        dry_run: true,
      },
      config,
      state
    );
    const stateSetCall = setCalls.find(c => c.key === 'state_set');
    const fn = stateSetCall!.value as (k: string, v: string) => Promise<boolean>;
    await expect(fn('key', 'v'.repeat(4097))).rejects.toThrow('4096 chars');
  });
});
