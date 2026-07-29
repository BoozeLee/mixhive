/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/profile-coach/route';

const fromMock = jest.fn();
const fetchSpy = jest.spyOn(global, 'fetch');

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.OPENAI_API_KEY = 'sk-test';
});

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: () => ({ then: (cb: Function) => cb({ data: { is_admin: false, is_pro: false, display_name: 'DJ Test' }, error: null }) }),
          }),
        }),
      };
    }
    if (table === 'user_ai_keys') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({ then: (cb: Function) => cb({ data: { openai_api_key: 'sk-user' }, error: null }) }),
          }),
        }),
      };
    }
    if (table === 'mixes') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              then: (cb: Function) => cb({ count: 3, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'ai_suggestions') {
      return {
        insert: () => ({
          select: () => ({
            single: () => ({ then: (cb: Function) => cb({ data: { id: 's1', status: 'pending' }, error: null }) }),
          }),
        }),
      };
    }
    return {};
  });
});

afterAll(() => fetchSpy.mockRestore());

const COACH_RESPONSE = JSON.stringify({
  score: 72,
  headline: 'Needs more bio',
  suggestions: [{ field: 'bio', issue: 'No bio', suggestion: 'Add a bio', priority: 1 }],
  bio_rewrite: null,
  rationale: 'Profile is incomplete.',
});

describe('POST /api/ai/profile-coach', () => {
  it('returns 401 without auth', async () => {
    const res = await POST(new NextRequest('https://test.vercel.app/api/ai/profile-coach', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(401);
  });

  it('returns coaching suggestions with valid profile', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: COACH_RESPONSE } }],
    }), { status: 200 }));

    const res = await POST(new NextRequest('https://test.vercel.app/api/ai/profile-coach', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-jwt' },
      body: JSON.stringify({}),
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.suggestion).toBeDefined();
  });

  it('returns 500 when GPT returns invalid JSON', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: 'not json' } }],
    }), { status: 200 }));

    const res = await POST(new NextRequest('https://test.vercel.app/api/ai/profile-coach', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-jwt' },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(500);
  });
});
