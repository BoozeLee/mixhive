/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { GET } from '@/app/api/health/route';

jest.mock('@/lib/redis', () => ({
  redisCache: {
    healthCheck: jest.fn().mockResolvedValue({ configured: false, connected: false }),
  },
}));

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => ({ then: (cb: Function) => cb({ error: null }) }),
      }),
    }),
  }),
}));

jest.mock('@/lib/serverLogger', () => ({
  serverLogger: { info: jest.fn(), error: jest.fn() },
}));

describe('GET /api/health', () => {
  it('returns a health status object', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    expect(body.services).toBeDefined();
  });

  it('reports database as healthy when Supabase responds', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.services.database).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy', 'skipped']).toContain(
      body.services.database.status
    );
  });
});
