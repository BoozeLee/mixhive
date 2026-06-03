import { NextRequest, NextResponse } from 'next/server';
import { redisCache } from '@/lib/redis';
import { rateLimiter } from '@/lib/rateLimiter';

export async function GET(request: NextRequest) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      redis: await checkRedis(),
      rateLimit: await checkRateLimit(),
      supabase: await checkSupabase(),
      websocket: await checkWebSocket(),
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  // Determine overall status
  const unhealthyServices = Object.entries(health.services).filter(
    ([_, status]) => status.status === 'unhealthy'
  );

  if (unhealthyServices.length > 0) {
    health.status = 'degraded';
  }

  return NextResponse.json(health);
}

async function checkRedis() {
  try {
    const healthCheck = await redisCache.healthCheck();

    return {
      status: healthCheck.connected ? 'healthy' : 'unhealthy',
      configured: healthCheck.configured,
      host: healthCheck.host,
      port: healthCheck.port,
      protocol: healthCheck.protocol,
      latency: healthCheck.latency,
      memoryUsage: healthCheck.memoryUsage,
      keyCount: healthCheck.keyCount,
      connected: healthCheck.connected,
      error: healthCheck.error,
      errorCode: healthCheck.errorCode,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: 0,
      memoryUsage: 'N/A',
      keyCount: 0,
      connected: false,
    };
  }
}

async function checkRateLimit() {
  try {
    // Test rate limiter with a dummy identifier
    const result = await rateLimiter.checkLimit('health-check', { window: 60, limit: 1 });

    return {
      status: result.allowed ? 'healthy' : 'degraded',
      remaining: result.remaining,
      limit: result.limit,
      reset: result.reset,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      remaining: 0,
      limit: 0,
      reset: 0,
    };
  }
}

async function checkSupabase() {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const hasNextPublicSupabasePair = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const supabaseUrl = hasNextPublicSupabasePair
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = hasNextPublicSupabasePair
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        status: 'unhealthy',
        error: 'Supabase public URL or anon key is missing',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // Simple health check by trying to get session
    const { error } = await supabase.from('profiles').select('count').limit(1);

    return {
      status: error ? 'unhealthy' : 'healthy',
      error: error?.message || null,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkWebSocket() {
  try {
    // Check if WebSocket server is accessible
    const wsUrl = process.env.WEBSOCKET_URL || process.env.WEB_SOCKET_URL;
    if (!wsUrl || wsUrl.includes('localhost') || !wsUrl.startsWith('http')) {
      return {
        status: 'skipped',
        reason: 'No external WebSocket health URL configured',
      };
    }

    const response = await fetch(`${wsUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      statusCode: response.status,
      url: wsUrl,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      url: process.env.WEBSOCKET_URL || process.env.WEB_SOCKET_URL || null,
    };
  }
}
