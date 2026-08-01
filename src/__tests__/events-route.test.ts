/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/events/route';

const mockEvents = [
  {
    id: 'e1',
    title: 'Rave Night',
    status: 'published',
    starts_at: '2026-08-01T20:00:00Z',
    organizer_id: 'u1',
  },
];
const mockRsvps = [{ event_id: 'e1', status: 'going' }];

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

describe('GET /api/events', () => {
  it('returns published events', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                range: () => ({
                  then: (cb: Function) => cb({ data: mockEvents, error: null, count: 1 }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'event_rsvps') {
        return {
          select: () => ({
            in: () => ({
              neq: () => ({
                then: (cb: Function) => cb({ data: mockRsvps, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET(new NextRequest('https://test.vercel.app/api/events'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.events).toHaveLength(1);
  });
});

describe('POST /api/events', () => {
  it('returns 401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/events', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Event', starts_at: '2026-08-01T20:00:00Z' }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('creates an event with valid data', async () => {
    const mockEvent = { id: 'e2', title: 'New Event' };
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          insert: () => ({
            select: () => ({
              single: () => ({
                then: (cb: Function) => cb({ data: mockEvent, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'event_rsvps') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    const res = await POST(
      new NextRequest('https://test.vercel.app/api/events', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({
          title: 'New Event',
          starts_at: '2026-08-01T20:00:00Z',
          is_free: true,
        }),
      })
    );
    expect(res.status).toBe(201);
  });

  it('returns 400 for invalid data', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/events', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ title: '' }),
      })
    );
    expect(res.status).toBe(400);
  });
});
