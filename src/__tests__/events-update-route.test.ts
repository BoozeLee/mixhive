/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { PATCH } from '../app/api/events/[id]/route';

let mockUser: { id: string } | null = { id: 'organizer-1' };
let existingEvent: { organizer_id: string } | null = { organizer_id: 'organizer-1' };
let capturedUpdates: Record<string, unknown> | null = null;

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockUser ? null : new Error('no user'),
      }),
    },
    from: () => ({
      // Ownership lookup: .select('organizer_id').eq('id', id).maybeSingle()
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: existingEvent, error: null }),
        }),
      }),
      // Update path: .update(updates).eq('id', id).select().single()
      update: (updates: Record<string, unknown>) => {
        capturedUpdates = updates;
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { id: 'event-1', ...updates },
                error: null,
              }),
            }),
          }),
        };
      },
    }),
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

beforeEach(() => {
  mockUser = { id: 'organizer-1' };
  existingEvent = { organizer_id: 'organizer-1' };
  capturedUpdates = null;
});

const ctx = { params: Promise.resolve({ id: 'event-1' }) };

function makeReq(body: unknown, opts: { auth?: boolean } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) headers['authorization'] = 'Bearer test-jwt';
  return new NextRequest('https://mixhive.test/api/events/event-1', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/events/[id]', () => {
  it('rejects a request with no bearer token', async () => {
    const res = await PATCH(makeReq({ title: 'x' }, { auth: false }), ctx);
    expect(res.status).toBe(401);
  });

  it('rejects a request whose token resolves to no user', async () => {
    mockUser = null;
    const res = await PATCH(makeReq({ title: 'x' }), ctx);
    expect(res.status).toBe(401);
  });

  it('404s when the event does not exist', async () => {
    existingEvent = null;
    const res = await PATCH(makeReq({ title: 'x' }), ctx);
    expect(res.status).toBe(404);
  });

  it('403s when the caller is not the organizer', async () => {
    existingEvent = { organizer_id: 'someone-else' };
    const res = await PATCH(makeReq({ title: 'Hijacked' }), ctx);

    expect(res.status).toBe(403);
    expect(capturedUpdates).toBeNull();
  });

  it('400s on a status outside the allowed enum', async () => {
    const res = await PATCH(makeReq({ status: 'completed-ish' }), ctx);

    expect(res.status).toBe(400);
    expect(capturedUpdates).toBeNull();
  });

  it('400s when no updatable fields are supplied', async () => {
    const res = await PATCH(makeReq({ organizer_id: 'attacker' }), ctx);
    expect(res.status).toBe(400);
  });

  it('ignores fields outside the allow-list rather than writing them', async () => {
    const res = await PATCH(
      makeReq({ title: 'Real Title', organizer_id: 'attacker', id: 'other-event' }),
      ctx
    );

    expect(res.status).toBe(200);
    expect(capturedUpdates).toEqual({ title: 'Real Title' });
  });

  it('updates allow-listed fields and returns the row', async () => {
    const res = await PATCH(
      makeReq({
        title: 'Warehouse Session',
        starts_at: '2026-08-01T20:00:00.000Z',
        is_free: false,
        status: 'published',
      }),
      ctx
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(capturedUpdates).toEqual({
      title: 'Warehouse Session',
      starts_at: '2026-08-01T20:00:00.000Z',
      is_free: false,
      status: 'published',
    });
    expect(body.id).toBe('event-1');
  });

  it('accepts cancelled as a status so the cancel flow shares this route', async () => {
    const res = await PATCH(makeReq({ status: 'cancelled' }), ctx);

    expect(res.status).toBe(200);
    expect(capturedUpdates).toEqual({ status: 'cancelled' });
  });
});
