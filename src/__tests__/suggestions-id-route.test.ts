/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/ai/suggestions/[id]/route';

function makeChain(result: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  const thenable = { then: (resolve: Function) => resolve({ data: result, error }) };
  chain.select = pass;
  chain.eq = pass;
  chain.maybeSingle = () => thenable;
  chain.single = () => thenable;
  chain.update = () => chain;
  chain.insert = () => chain;
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

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockImplementation((table: string) => {
    if (table === 'profiles') return makeChain({ is_admin: false, is_pro: false });
    if (table === 'user_ai_keys') return makeChain({ openai_api_key: 'sk-user' });
    return makeChain(null);
  });
});

describe('PATCH /api/ai/suggestions/[id]', () => {
  it('returns 401 without auth', async () => {
    const res = await PATCH(
      new NextRequest('https://test.vercel.app/api/ai/suggestions/s1', { method: 'PATCH', body: JSON.stringify({ action: 'apply' }) }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid action', async () => {
    const res = await PATCH(
      new NextRequest('https://test.vercel.app/api/ai/suggestions/s1', {
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ action: 'invalid' }),
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(400);
  });

  it('applies a suggestion', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') return makeChain({ is_admin: false, is_pro: false });
      if (table === 'user_ai_keys') return makeChain({ openai_api_key: 'sk-user' });
      if (table === 'ai_suggestions') return makeChain({ id: 's1', status: 'applied' });
      return makeChain(null);
    });

    const res = await PATCH(
      new NextRequest('https://test.vercel.app/api/ai/suggestions/s1', {
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ action: 'apply' }),
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.suggestion.status).toBe('applied');
  });

  it('rejects a suggestion', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') return makeChain({ is_admin: false, is_pro: false });
      if (table === 'user_ai_keys') return makeChain({ openai_api_key: 'sk-user' });
      if (table === 'ai_suggestions') return makeChain({ id: 's1', status: 'rejected' });
      return makeChain(null);
    });

    const res = await PATCH(
      new NextRequest('https://test.vercel.app/api/ai/suggestions/s1', {
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ action: 'reject' }),
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.suggestion.status).toBe('rejected');
  });

  it('rates a suggestion', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') return makeChain({ is_admin: false, is_pro: false });
      if (table === 'user_ai_keys') return makeChain({ openai_api_key: 'sk-user' });
      if (table === 'ai_suggestions') return makeChain({ id: 's1', status: 'pending' });
      if (table === 'ai_feedback') return makeChain({ id: 'f1', rating: 4 });
      return makeChain(null);
    });

    const res = await PATCH(
      new NextRequest('https://test.vercel.app/api/ai/suggestions/s1', {
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ action: 'rate', rating: 4, comment: 'Good suggestion' }),
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.feedback.rating).toBe(4);
  });

  it('returns 400 for invalid rating', async () => {
    const res = await PATCH(
      new NextRequest('https://test.vercel.app/api/ai/suggestions/s1', {
        method: 'PATCH',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ action: 'rate', rating: 10 }),
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(400);
  });
});
