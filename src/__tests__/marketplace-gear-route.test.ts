/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/marketplace/gear/route';

const mockListings = [
  {
    id: 'g1',
    title: 'Pioneer CDJ-3000',
    category: 'cdj',
    price: 1500,
    status: 'active',
    seller_profile_id: 'u1',
    condition: 'used_good',
    photos: ['img1.jpg'],
  },
];

const fromMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/marketplace/gear', () => {
  it('returns active listings', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              range: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      gte: () => ({
                        lte: () => ({
                          then: (cb: Function) => cb({ data: mockListings, error: null, count: 1 }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const res = await GET(new NextRequest('https://test.vercel.app/api/marketplace/gear'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.listings).toBeDefined();
  });

  it('returns 500 on Supabase error', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              range: () => ({
                then: (cb: Function) => cb({ data: null, error: { message: 'DB error' } }),
              }),
            }),
          }),
        }),
      }),
    });

    const res = await GET(new NextRequest('https://test.vercel.app/api/marketplace/gear'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/marketplace/gear', () => {
  it('returns 401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/marketplace/gear', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('creates a listing with valid auth and payouts enabled', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                then: (cb: Function) => cb({ data: { payouts_enabled: true }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'equipment_listings') {
        return {
          insert: () => ({
            select: () => ({
              single: () => ({
                then: (cb: Function) => cb({ data: { id: 'g2', title: 'New Gear' }, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await POST(
      new NextRequest('https://test.vercel.app/api/marketplace/gear', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({
          title: 'Pioneer CDJ',
          category: 'cdj',
          condition: 'used_good',
          price: 500,
          photos: ['https://imgur.com/test.jpg'],
        }),
      })
    );
    expect(res.status).toBe(201);
  });

  it('returns 403 when payouts not enabled', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                then: (cb: Function) => cb({ data: { payouts_enabled: false }, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await POST(
      new NextRequest('https://test.vercel.app/api/marketplace/gear', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({
          title: 'Test',
          category: 'cdj',
          condition: 'new',
          price: 100,
          photos: ['x.jpg'],
        }),
      })
    );
    expect(res.status).toBe(403);
  });
});
