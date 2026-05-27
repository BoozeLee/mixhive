import { NextRequest, NextResponse } from 'next/server'
import { redisCache } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const key = searchParams.get('key')
    const value = searchParams.get('value')

    switch (action) {
      case 'health':
        return await handleHealthCheck()
      
      case 'get':
        return await handleGet(key)
      
      case 'set':
        return await handleSet(key, value)
      
      case 'delete':
        return await handleDelete(key)
      
      case 'keys':
        return await handleKeys(searchParams.get('pattern'))
      
      case 'stats':
        return await handleStats()
      
      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use ?action=health|get|set|delete|keys|stats' 
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Redis API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleHealthCheck() {
  const health = await redisCache.healthCheck()
  
  return NextResponse.json({
    status: health.connected ? 'healthy' : 'unhealthy',
    latency: health.latency,
    memoryUsage: health.memoryUsage,
    keyCount: health.keyCount,
    isConnected: redisCache.isHealthy()
  })
}

async function handleGet(key: string | null) {
  if (!key) {
    return NextResponse.json({ error: 'Key parameter required' }, { status: 400 })
  }

  try {
    const value = await redisCache.get(key)
    return NextResponse.json({
      key,
      value,
      exists: value !== null,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get value',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleSet(key: string | null, value: string | null) {
  if (!key || !value) {
    return NextResponse.json({ error: 'Key and value parameters required' }, { status: 400 })
  }

  try {
    // Parse JSON if it looks like JSON
    let parsedValue
    try {
      parsedValue = JSON.parse(value)
    } catch {
      parsedValue = value
    }

    await redisCache.set(key, parsedValue)
    
    return NextResponse.json({
      success: true,
      key,
      value: parsedValue,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to set value',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleDelete(key: string | null) {
  if (!key) {
    return NextResponse.json({ error: 'Key parameter required' }, { status: 400 })
  }

  try {
    const existed = await redisCache.exists(key)
    await redisCache.del(key)
    
    return NextResponse.json({
      success: true,
      key,
      existed,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to delete key',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleKeys(pattern: string | null) {
  const searchPattern = pattern || '*'
  
  try {
    const keys = await redisCache.client.keys(searchPattern)
    
    return NextResponse.json({
      pattern: searchPattern,
      count: keys.length,
      keys: keys.slice(0, 100), // Limit to 100 keys
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to search keys',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function handleStats() {
  try {
    const [dbsize, info, memory] = await Promise.all([
      redisCache.client.dbsize(),
      redisCache.client.info('keyspace'),
      redisCache.client.info('memory')
    ])

    const keyspaceInfo = {}
    const keyspaces = info.split('\n').filter(line => line.startsWith('db'))
    keyspaces.forEach(line => {
      const [db, stats] = line.split(':')
      const statsObj = {}
      stats.split(',').forEach(stat => {
        const [key, value] = stat.split('=')
        statsObj[key] = value
      })
      keyspaceInfo[db] = statsObj
    })

    return NextResponse.json({
      totalKeys: dbsize,
      keyspaceInfo,
      memoryInfo: memory,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, key, value, ttl } = body

    switch (action) {
      case 'setWithTTL':
        if (!key || value === undefined) {
          return NextResponse.json({ error: 'Key and value required' }, { status: 400 })
        }
        
        await redisCache.set(key, value, { ttl })
        return NextResponse.json({
          success: true,
          key,
          value,
          ttl,
          timestamp: new Date().toISOString()
        })

      case 'increment':
        if (!key) {
          return NextResponse.json({ error: 'Key required' }, { status: 400 })
        }
        
        const newValue = await redisCache.client.incr(key)
        return NextResponse.json({
          success: true,
          key,
          newValue,
          timestamp: new Date().toISOString()
        })

      case 'decrement':
        if (!key) {
          return NextResponse.json({ error: 'Key required' }, { status: 400 })
        }
        
        const decrValue = await redisCache.client.decr(key)
        return NextResponse.json({
          success: true,
          key,
          newValue: decrValue,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Redis POST error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}