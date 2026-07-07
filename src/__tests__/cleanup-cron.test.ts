/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cleanup/route';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: mockFrom,
  }),
}));

describe('cleanup cron', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  function createQueryBuilder(response: unknown = { data: [], error: null }) {
    const chain: Record<string, unknown> = {
      eq: jest.fn(() => chain),
      lt: jest.fn(() => chain),
      select: jest.fn(() => chain),
      delete: jest.fn(() => chain),
      update: jest.fn(() => chain),
      then: jest.fn(cb => Promise.resolve(cb(response))),
    };
    return chain;
  }

  function req() {
    return new NextRequest('https://mixhive.test/api/cleanup', {
      headers: { authorization: 'Bearer cron-secret' },
    });
  }

  it('rejects requests without CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const res = await GET(new NextRequest('https://mixhive.test/api/cleanup'));
    expect(res.status).toBe(401);
  });

  it('removes old read and unread notifications plus failed jobs', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    mockFrom.mockImplementation((table: string) => {
      if (table === 'audio_jobs') {
        return createQueryBuilder({ data: [{ id: 'job-1' }], error: null });
      }
      if (table === 'notifications') {
        return createQueryBuilder({ data: [{ id: 'notif-1' }, { id: 'notif-2' }], error: null });
      }
      return createQueryBuilder();
    });

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.failed_audio_jobs_removed).toBe(1);
    expect(body.old_read_notifications_removed).toBe(2);
  });
});
