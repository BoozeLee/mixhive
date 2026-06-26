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
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation(() => ({
      upsert: () => Promise.resolve({ error: null }),
    }));
  });

  function req() {
    return new NextRequest('https://mixhive.test/api/analytics/daily', {
      headers: { authorization: 'Bearer cron-secret' },
    });
  }

  it('calls both platform snapshot and per-profile rollup', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('get_hive_stats');
    expect(mockRpc).toHaveBeenCalledWith('rollup_profile_analytics', {
      p_day: expect.any(String),
    });
  });
});
