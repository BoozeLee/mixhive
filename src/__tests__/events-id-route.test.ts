/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '@/app/api/events/[id]/route';

const mockEvent = { id: 'e1', title: 'Rave Night', organizer_id: 'u1', status: 'published' };

function makeChain(result: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  const thenable = { then: (resolve: Function) => resolve({ data: result, error }) };
  chain.select = pass;
  chain.eq = pass;
  chain.neq = pass;
  chain.maybeSingle = () => thenable;
  chain.single = () => thenable;
  chain.update = () => chain;
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

describe('GET /api/events/[id]', () => {
  it('returns event with RSVP counts', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') return makeChain(mockEvent);
      if (table === 'event_rsvps') return makeChain([{ status: 'going', user: { id: 'u1' } }]);
      return makeChain([]);
    });

    const res = await GET(new NextRequest('https://test.vercel.app/api/events/e1'), {
      params: Promise.resolve({ id: 'e1' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.title).toBe('Rave Night');
  });
});

describe('PATCH /api/events/[id]', () => {
  it('updates event with valid auth', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => ({ then: (resolve: Function) => resolve({ data: mockEvent, error: null }) }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => ({ then: (resolve: Function) => resolve({ data: { ...mockEvent, title: 'Updated' }, error: null }) }),
              }),
            }),
          }),
        };
      }
      return makeChain(null);
    });

    const res = await PATCH(
      new NextRequest('https://test.vercel.app/api/events/e1', {
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ title: 'Updated Event' }),
      }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    expect(res.status).toBe(200);
  });

  it('returns 401 without auth', async () => {
    const res = await PATCH(
      new NextRequest('https://test.vercel.app/api/events/e1', { method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/events/[id]', () => {
  it('cancels event with valid auth', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'events') return makeChain(mockEvent);
      return makeChain(null);
    });

    const res = await DELETE(
      new NextRequest('https://test.vercel.app/api/events/e1', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-jwt' },
      }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await DELETE(
      new NextRequest('https://test.vercel.app/api/events/e1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'e1' }) }
    );
    expect(res.status).toBe(401);
  });
});
