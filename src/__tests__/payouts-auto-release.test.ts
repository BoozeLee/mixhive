/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/payouts-auto-release/route';

describe('payouts auto-release cron auth', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it('refuses to run when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(new NextRequest('https://mixhive.test/api/cron/payouts-auto-release'));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe('CRON_SECRET not configured');
  });

  it('rejects requests with the wrong bearer token', async () => {
    process.env.CRON_SECRET = 'correct-secret';

    const res = await GET(
      new NextRequest('https://mixhive.test/api/cron/payouts-auto-release', {
        headers: { authorization: 'Bearer wrong-secret' },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});
