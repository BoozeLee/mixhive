import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMITS: Record<string, { limit: number; window: number }> = {
  like: { limit: 60, window: 60 },
  follow: { limit: 30, window: 300 },
  unfollow: { limit: 30, window: 300 },
  comment: { limit: 20, window: 60 },
  upload: { limit: 10, window: 3600 },
  buzz: { limit: 20, window: 60 },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    if (!action || !userId) {
      return NextResponse.json({ error: 'action and userId required' }, { status: 400 });
    }

    const config = RATE_LIMITS[action];
    if (!config) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const { redisCache } = await import('@/lib/redis');
    const result = await redisCache.incrementRateLimit(
      `social:${action}:${userId}`,
      config.limit,
      config.window
    );

    return NextResponse.json({
      allowed: result.current <= config.limit,
      remaining: result.remaining,
      limit: config.limit,
      current: result.current,
      reset: result.reset,
    });
  } catch {
    return NextResponse.json({ allowed: true, remaining: 1, limit: 1, current: 0, reset: 0 });
  }
}
