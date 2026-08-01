/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/stripe/connect/status/route';

const fromMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

jest.mock('stripe', () => ({
  default: jest.fn().mockImplementation(() => ({
    accounts: {
      retrieve: jest.fn().mockResolvedValue({
        payouts_enabled: true,
        charges_enabled: true,
        requirements: { currently_due: [] },
      }),
    },
  })),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/stripe/connect/status', () => {
  it('returns 503 when STRIPE_SECRET_KEY is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await GET(new NextRequest('https://test.vercel.app/api/stripe/connect/status'));
    expect(res.status).toBe(503);
  });

  it('returns 401 without auth header', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    const res = await GET(new NextRequest('https://test.vercel.app/api/stripe/connect/status'));
    expect(res.status).toBe(401);
  });

  it('returns onboarded false when no stripe_account_id', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                then: (cb: Function) => cb({ data: { stripe_account_id: null }, error: null }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              then: (cb: Function) => cb({ error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET(
      new NextRequest('https://test.vercel.app/api/stripe/connect/status', {
        headers: { authorization: 'Bearer valid-jwt' },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.onboarded).toBe(false);
  });
});
