import { NextRequest, NextResponse } from 'next/server';
import { redisCache } from '@/lib/redis';

export async function POST(req: NextRequest) {
  try {
    const { userId, mixId } = await req.json();

    if (userId) {
      await redisCache.invalidateUserCache(userId);
    }

    if (mixId) {
      await redisCache.invalidateMixCache(mixId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
