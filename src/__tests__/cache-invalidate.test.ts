/**
 * @jest-environment node
 */

jest.mock('@/lib/redis', () => ({
  redisCache: {
    invalidateUserCache: jest.fn(),
    invalidateMixCache: jest.fn(),
  },
}));

import { POST } from '@/app/api/cache/invalidate/route';
import { redisCache } from '@/lib/redis';
import { NextRequest } from 'next/server';

const mockCache = redisCache as {
  invalidateUserCache: jest.Mock;
  invalidateMixCache: jest.Mock;
};

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/cache/invalidate', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

describe('POST /api/cache/invalidate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.invalidateUserCache.mockResolvedValue(undefined);
    mockCache.invalidateMixCache.mockResolvedValue(undefined);
  });

  it('calls invalidateUserCache when userId provided', async () => {
    const res = await post({ userId: 'u1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCache.invalidateUserCache).toHaveBeenCalledWith('u1');
    expect(mockCache.invalidateMixCache).not.toHaveBeenCalled();
  });

  it('calls invalidateMixCache when mixId provided', async () => {
    const res = await post({ mixId: 'm1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCache.invalidateMixCache).toHaveBeenCalledWith('m1');
    expect(mockCache.invalidateUserCache).not.toHaveBeenCalled();
  });

  it('returns success without calling either when neither provided', async () => {
    const res = await post({});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockCache.invalidateUserCache).not.toHaveBeenCalled();
    expect(mockCache.invalidateMixCache).not.toHaveBeenCalled();
  });

  it('returns 500 on malformed JSON body', async () => {
    const res = await post('not-json');
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
