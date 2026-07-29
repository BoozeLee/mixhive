/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/monthly-recap/route';

const mockFrom = jest.fn();
const mockSend = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

describe('monthly-recap cron', () => {
  let originalCronSecret: string | undefined;

  beforeEach(() => {
    originalCronSecret = process.env.CRON_SECRET;
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'MixHive <hello@mixhive.app>';
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            data: [{ id: 'u1', display_name: 'DJ Test', email: 'test@mixhive.app' }],
            error: null,
          }),
        };
      }
      if (table === 'mixes') {
        return {
          select: () => ({
            eq: () => ({ gte: () => ({ data: [], error: null }) }),
          }),
        };
      }
      if (table === 'profile_analytics_daily') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                data: [{ plays: 10, likes: 2, comments: 1, follows: 3 }],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  function req() {
    return new NextRequest('https://mixhive.test/api/cron/monthly-recap', {
      headers: { authorization: 'Bearer cron-secret' },
    });
  }

  it('sends a recap email when analytics exist', async () => {
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recaps).toBe(1);
    expect(body.sent).toBe(1);
    expect(mockSend).toHaveBeenCalled();
  });

  it('allows access when no CRON_SECRET is configured (dev mode)', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new NextRequest('https://mixhive.test/api/cron/monthly-recap'));
    expect(res.status).toBe(200);
  });

  it('returns 401 with wrong cron secret', async () => {
    process.env.CRON_SECRET = 'real-secret';
    const res = await GET(new NextRequest('https://mixhive.test/api/cron/monthly-recap', {
      headers: { authorization: 'Bearer wrong-secret' },
    }));
    expect(res.status).toBe(401);
  });
});
