// Tests for ToolBridge: catalogue building, whitelist enforcement, helper functions.

import { buildToolCatalogue, buildRuntimeHelpers } from '@/server/lua-agents/ToolBridge';
import type { AgentConfig } from '@/server/lua-agents/agent.types';

const BASE_CONFIG: AgentConfig = {
  id: 'profile_coach',
  display_name: 'Profile Coach',
  description: 'Test agent',
  tier: 'free',
  lua_script: '-- test',
  lua_script_version: 1,
  tools_whitelist: ['db.read', 'db.read_one', 'llm.call'],
  approval_policy: 'on_action',
  timeout_ms: 5000,
  max_tokens_per_run: 512,
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('buildToolCatalogue', () => {
  it('only includes whitelisted tools', () => {
    const cat = buildToolCatalogue(BASE_CONFIG);
    expect(Object.keys(cat).sort()).toEqual(['db.read', 'db.read_one', 'llm.call'].sort());
  });

  it('excludes unknown tools with a warning', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { ...BASE_CONFIG, tools_whitelist: ['db.read', 'nonexistent.tool'] };
    const cat = buildToolCatalogue(config);
    expect(cat['nonexistent.tool']).toBeUndefined();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('nonexistent.tool'));
    spy.mockRestore();
  });

  it('silently ignores runtime.allowed_tools sentinel', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { ...BASE_CONFIG, tools_whitelist: ['runtime.allowed_tools', 'db.read'] };
    const cat = buildToolCatalogue(config);
    expect(cat['runtime.allowed_tools']).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('includes db.rpc when whitelisted', () => {
    const config = { ...BASE_CONFIG, tools_whitelist: ['db.rpc'] };
    const cat = buildToolCatalogue(config);
    expect(typeof cat['db.rpc']).toBe('function');
  });
});

describe('buildRuntimeHelpers', () => {
  const state = { logs: [] as string[] };
  const helpers = buildRuntimeHelpers(BASE_CONFIG, state);

  it('mh_log appends to state.logs', () => {
    state.logs = [];
    helpers.mh_log('hello', 'world');
    expect(state.logs).toEqual(['hello world']);
  });

  it('mh_get_logs returns current log array', () => {
    state.logs = ['a', 'b'];
    expect(helpers.mh_get_logs()).toEqual(['a', 'b']);
  });

  describe('suggestion helper', () => {
    it('clamps confidence to [0,1]', () => {
      const s = helpers.suggestion('test', {}, 1.5, 'r', false);
      expect(s.confidence).toBe(1);
      const s2 = helpers.suggestion('test', {}, -0.5, 'r', false);
      expect(s2.confidence).toBe(0);
    });

    it('forces NaN confidence to 0', () => {
      const s = helpers.suggestion('test', {}, NaN, 'r', false);
      expect(s.confidence).toBe(0);
    });

    it('respects requires_approval flag', () => {
      const s = helpers.suggestion('test', {}, 0.8, 'r', true);
      expect(s.requires_approval).toBe(true);
    });
  });

  describe('task helper', () => {
    it('defaults priority to medium', () => {
      const t = helpers.task('Do something');
      expect(t.priority).toBe('medium');
    });

    it('sets due_date when provided', () => {
      const t = helpers.task('Do something', 'high', '2026-06-01');
      expect(t.due_date).toBe('2026-06-01');
    });

    it('attaches agent_id', () => {
      const t = helpers.task('Do something');
      expect(t.agent_id).toBe('profile_coach');
    });
  });

  describe('notify helper', () => {
    it('defaults channel to in_app', () => {
      const n = helpers.notify('Subject', 'Body');
      expect(n.channel).toBe('in_app');
    });

    it('allows email channel', () => {
      const n = helpers.notify('Subject', 'Body', 'email', '/url');
      expect(n.channel).toBe('email');
      expect(n.cta_url).toBe('/url');
    });
  });
});
