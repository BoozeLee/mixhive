import type { LuaEngine } from 'wasmoon';
import type { LuaSandboxContext, ToolCatalogue } from './agent.types';
import type { BridgeState } from './ToolBridge';
import { buildRuntimeHelpers } from './ToolBridge';
import type { AgentConfig } from './agent.types';
import { buildStateTools } from './tools/state';

export async function installSandbox(
  engine: LuaEngine,
  tools: ToolCatalogue,
  ctx: LuaSandboxContext,
  config: AgentConfig,
  state: BridgeState
): Promise<void> {
  const helpers = buildRuntimeHelpers(config, state);
  const stateTools = buildStateTools(config.id, ctx.profile_id);

  engine.global.set('ctx', ctx);
  engine.global.set('mixhive', tools);
  engine.global.set('mh_log', helpers.mh_log);
  engine.global.set('mh_get_logs', helpers.mh_get_logs);
  engine.global.set('suggestion', helpers.suggestion);
  engine.global.set('task', helpers.task);
  engine.global.set('notify', helpers.notify);
  engine.global.set('state_get', stateTools.state_get);
  engine.global.set('state_set', stateTools.state_set);
  engine.global.set('state_del', stateTools.state_del);

  await engine.doString(`
    debug = nil
    io = nil
    os = nil
    package = nil
    require = nil
    collectgarbage = nil
  `);
}

export async function resetSandboxState(engine: LuaEngine): Promise<void> {
  await engine.doString(`
    ctx = nil
    mixhive = nil
    mh_log = nil
    mh_get_logs = nil
    suggestion = nil
    task = nil
    notify = nil
    run = nil
    _result = nil
    state_get = nil
    state_set = nil
    state_del = nil
  `);
}
