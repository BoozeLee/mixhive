import { NextRequest, NextResponse } from 'next/server'
import { redisCache } from '@/lib/redis'
import { rateLimiter } from '@/lib/rateLimiter'

export async function GET(request: NextRequest) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      redis: await checkRedis(),
      rateLimit: await checkRateLimit(),
      supabase: await checkSupabase(),
      websocket: await checkWebSocket()
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  }

  // Determine overall status
  const unhealthyServices = Object.entries(health.services)
    .filter(([_, status]) => status.status !== 'healthy')
  
  if (unhealthyServices.length > 0) {
    health.status = 'degraded'
  }

  return NextResponse.json(health)
}

async function checkRedis() {
  try {
    const isHealthy = redisCache.isHealthy()
    const latency = await redisCache.client.ping()
    const healthCheck = await redisCache.healthCheck()

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      latency: parseInt(latency),
      memoryUsage: healthCheck.memoryUsage,
      keyCount: healthCheck.keyCount,
      connected: healthCheck.connected
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: 0,
      memoryUsage: 'N/A',
      keyCount: 0,
      connected: false
    }
  }
}

async function checkRateLimit() {
  try {
    // Test rate limiter with a dummy identifier
    const result = await rateLimiter.checkLimit('health-check', { window: 60, limit: 1 })
    
    return {
      status: result.allowed ? 'healthy' : 'degraded',
      remaining: result.remaining,
      limit: result.limit,
      reset: result.reset
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      remaining: 0,
      limit: 0,
      reset: 0
    }
  }
}

async function checkSupabase() {
  try {
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Simple health check by trying to get session
    const { error } = await supabase.from('profiles').select('count').limit(1)
    
    return {
      status: error ? 'unhealthy' : 'healthy',
      error: error?.message || null
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkWebSocket() {
  try {
    // Check if WebSocket server is accessible
    const wsUrl = process.env.WEBSOCKET_URL || 'http://localhost:3001/api/websocket'
    const response = await fetch(`${wsUrl}/health`, {
      method: 'GET',
      timeout: 5000
    })
    
    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      statusCode: response.status,
      url: wsUrl
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      url: process.env.WEB_SOCKET_URL || 'http://localhost:3001/api/websocket'
    }
  }
}