/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/analytics/daily/route';

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

describe('analytics daily cron', () => {
  let originalCronSecret: string | undefined;

  beforeEach(() => {
    originalCronSecret = process.env.CRON_SECRET;
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation(() => ({
      upsert: () => Promise.resolve({ error: null }),
    }));
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  function req() {
    return new NextRequest('https://mixhive.test/api/analytics/daily', {
      headers: { authorization: 'Bearer cron-secret' },
    });
  }

  it('calls both platform snapshot and per-profile rollup', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const expectedDate = new Date();
    expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
    const yesterday = expectedDate.toISOString().slice(0, 10);
    expect(mockRpc.mock.calls[0]).toEqual(['get_hive_stats']);
    expect(mockRpc.mock.calls[1]).toEqual(['rollup_profile_analytics', { p_day: yesterday }]);
  });

  it('returns 401 without valid cron secret', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new NextRequest('https://mixhive.test/api/analytics/daily'));
    expect(res.status).toBe(401);
  });
});
