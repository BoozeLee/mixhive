/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/events/[id]/rsvp/route';

const mockEvent = { id: 'e1', status: 'published', max_attendees: null };

function makeChain(result: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  const thenable = { then: (resolve: Function) => resolve({ data: result, error }) };
  chain.select = pass;
  chain.eq = pass;
  chain.neq = pass;
  chain.maybeSingle = () => thenable;
  chain.single = () => thenable;
  chain.upsert = () => chain;
  chain.delete = () => chain;
  chain.then = thenable.then;
  return chain;
}

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

describe('POST /api/events/[id]/rsvp', () => {
  it('returns 401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/events/e1/rsvp', {
        method: 'POST',
        body: JSON.stringify({ status: 'going' }),
      }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('creates RSVP with valid data', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') return makeChain(mockEvent);
      if (table === 'event_rsvps') {
        return {
          select: () => ({
            eq: () => ({
              neq: () => ({ then: (resolve: Function) => resolve({ data: null, count: 0, error: null }) }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              single: () => ({ then: (resolve: Function) => resolve({ data: { event_id: 'e1', user_id: 'u1', status: 'going' }, error: null }) }),
            }),
          }),
        };
      }
      return makeChain(null);
    });

    const res = await POST(
      new NextRequest('https://test.vercel.app/api/events/e1/rsvp', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ status: 'going' }),
      }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('going');
  });
});

describe('DELETE /api/events/[id]/rsvp', () => {
  it('returns 401 without auth', async () => {
    const res = await DELETE(
      new NextRequest('https://test.vercel.app/api/events/e1/rsvp', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('removes RSVP with valid auth', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'event_rsvps') return makeChain(null);
      return makeChain(null);
    });

    const res = await DELETE(
      new NextRequest('https://test.vercel.app/api/events/e1/rsvp', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-jwt' },
      }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
