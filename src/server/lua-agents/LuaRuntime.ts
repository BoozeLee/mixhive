import { LuaFactory, LuaEngine } from 'wasmoon'
import path from 'path'

interface PooledEngine {
  engine: LuaEngine
  busy: boolean
  createdAt: number
}

const POOL_SIZE = Number.parseInt(process.env.LUA_POOL_SIZE ?? '4', 10)
const ENGINE_MAX_AGE_MS = 5 * 60 * 1000

let factory: LuaFactory | null = null
const pool: PooledEngine[] = []

async function getFactory(): Promise<LuaFactory> {
  if (!factory) {
    factory = new LuaFactory(path.join(process.cwd(), 'node_modules/wasmoon/dist/glue.wasm'))
  }
  return factory
}

export async function acquireEngine(): Promise<LuaEngine> {
  const now = Date.now()

  for (const slot of pool) {
    if (!slot.busy && now - slot.createdAt < ENGINE_MAX_AGE_MS) {
      slot.busy = true
      return slot.engine
    }
  }

  for (const slot of pool) {
    if (!slot.busy && now - slot.createdAt >= ENGINE_MAX_AGE_MS) {
      try {
        slot.engine.global.close()
      } catch {
        // Closing is best-effort; a fresh engine is created below.
      }
      const runtimeFactory = await getFactory()
      slot.engine = await runtimeFactory.createEngine()
      slot.createdAt = now
      slot.busy = true
      return slot.engine
    }
  }

  if (pool.length < POOL_SIZE) {
    const runtimeFactory = await getFactory()
    const engine = await runtimeFactory.createEngine()
    pool.push({ engine, busy: true, createdAt: now })
    return engine
  }

  await new Promise((resolve) => setTimeout(resolve, 50))
  return acquireEngine()
}

export function releaseEngine(engine: LuaEngine): void {
  const slot = pool.find((entry) => entry.engine === engine)
  if (slot) {
    slot.busy = false
  }
}

export async function shutdownPool(): Promise<void> {
  for (const slot of pool) {
    try {
      slot.engine.global.close()
    } catch {
      // Ignore close failures during process shutdown.
    }
  }
  pool.length = 0
  factory = null
}

export function getPoolStats() {
  return {
    pool_size: pool.length,
    busy: pool.filter((slot) => slot.busy).length,
    max_size: POOL_SIZE,
  }
}
