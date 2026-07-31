/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/flow-spores/route';

const sporeRows = [
  {
    id: 'sp1',
    session_id: 'se1',
    turned_by: 'u1',
    state: 'sealed',
    sealed_at: '2026-07-30T22:00:00.000Z',
    created_at: '2026-07-30T21:00:00.000Z',
    generation: 0,
    parent_hash: null,
    content_hash: 'a'.repeat(64),
    capped_count: 3,
    skipped_count: 2,
    carbon: {},
    silica: {},
  },
];

const fromMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  const pass = () => c;
  const thenable = { then: (resolve: Function) => resolve({ data: result, error: null }) };
  c.select = pass;
  c.eq = pass;
  c.in = pass;
  c.order = pass;
  c.limit = () => thenable;
  c.then = thenable.then;
  return c;
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockImplementation((table: string) => {
    if (table === 'flow_spores') return chain(sporeRows);
    if (table === 'flow_spore_contributors')
      return chain([
        { spore_id: 'sp1', fraction: 'carbon' },
        { spore_id: 'sp1', fraction: 'carbon' },
        { spore_id: 'sp1', fraction: 'silica' },
      ]);
    if (table === 'flow_spore_germinations')
      return chain([{ spore_id: 'sp1' }, { spore_id: 'sp1' }]);
    return chain([]);
  });
});

const authed = () =>
  new NextRequest('https://test.vercel.app/api/flow-spores', {
    headers: { authorization: 'Bearer t' },
  });

describe('GET /api/flow-spores', () => {
  it('401 without auth', async () => {
    const res = await GET(new NextRequest('https://test.vercel.app/api/flow-spores'));
    expect(res.status).toBe(401);
  });

  it('rolls contributor fractions and germinations into per-spore counts', async () => {
    const res = await GET(authed());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spores).toHaveLength(1);
    expect(body.spores[0]).toMatchObject({
      id: 'sp1',
      carbon_count: 2,
      silica_count: 1,
      germination_count: 2,
      is_mine: true,
    });
  });

  it('marks a spore turned by someone else as not mine', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'flow_spores') return chain([{ ...sporeRows[0], turned_by: 'someone-else' }]);
      return chain([]);
    });
    const body = await (await GET(authed())).json();
    expect(body.spores[0].is_mine).toBe(false);
  });

  it('returns an empty list without querying the count tables', async () => {
    fromMock.mockImplementation((table: string) =>
      table === 'flow_spores' ? chain([]) : chain([])
    );
    const body = await (await GET(authed())).json();
    expect(body.spores).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
