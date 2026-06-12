import { NextResponse } from 'next/server';
import { redisCache } from '@/lib/redis';
import { serverLogger } from '@/lib/serverLogger';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type ServiceStatus = {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'skipped';
  latency_ms?: number;
  pending?: number;
  processing?: number;
  failed?: number;
};

async function redisStatus(): Promise<ServiceStatus> {
  const started = Date.now();
  try {
    const result = await redisCache.healthCheck();
    return {
      status: !result.configured ? 'skipped' : result.connected ? 'healthy' : 'degraded',
      latency_ms: Date.now() - started,
    };
  } catch {
    return { status: 'degraded', latency_ms: Date.now() - started };
  }
}

async function databaseStatus(): Promise<ServiceStatus> {
  const started = Date.now();
  try {
    const { error } = await createServerClient().from('profiles').select('id').limit(1);
    return { status: error ? 'unhealthy' : 'healthy', latency_ms: Date.now() - started };
  } catch {
    return { status: 'unhealthy', latency_ms: Date.now() - started };
  }
}

async function queueStatus(table: 'audio_jobs' | 'push_delivery_jobs'): Promise<ServiceStatus> {
  try {
    const sb = createServerClient();
    const count = async (status: string) => {
      const { count: value, error } = await sb
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('status', status);
      if (error) throw error;
      return value ?? 0;
    };
    const [pending, processing, failed] = await Promise.all([
      count('pending'),
      count('processing'),
      count('failed'),
    ]);
    return {
      status: failed > 25 || processing > 100 ? 'degraded' : 'healthy',
      pending,
      processing,
      failed,
    };
  } catch {
    return { status: 'degraded' };
  }
}

export async function GET() {
  const services = {
    database: await databaseStatus(),
    redis: await redisStatus(),
    audio_queue: await queueStatus('audio_jobs'),
    push_queue: await queueStatus('push_delivery_jobs'),
  };
  const status = Object.values(services).some(service => service.status === 'unhealthy')
    ? 'unhealthy'
    : Object.values(services).some(service => service.status === 'degraded')
      ? 'degraded'
      : 'healthy';

  serverLogger.info('health_check', { status });
  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      release: process.env.NEXT_PUBLIC_RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
      services,
    },
    { status: status === 'unhealthy' ? 503 : 200 }
  );
}
