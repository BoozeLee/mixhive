/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/generate-bio/route';

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
  // Default: user has an AI key
  fromMock.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({
            single: () => ({
              then: (cb: Function) => cb({ data: { is_admin: false, is_pro: false }, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'user_ai_keys') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({
              then: (cb: Function) => cb({ data: { openai_api_key: 'sk-user' }, error: null }),
            }),
          }),
        }),
      };
    }
    return {};
  });
});

afterAll(() => fetchSpy.mockRestore());

describe('POST /api/ai/generate-bio', () => {
  it('returns 401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/ai/generate-bio', {
        method: 'POST',
        body: JSON.stringify({ displayName: 'DJ Test' }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('returns 402 when user has no AI key', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                then: (cb: Function) =>
                  cb({ data: { is_admin: false, is_pro: false }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'user_ai_keys') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => ({ then: (cb: Function) => cb({ data: null, error: null }) }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await POST(
      new NextRequest('https://test.vercel.app/api/ai/generate-bio', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ displayName: 'DJ Test' }),
      })
    );
    expect(res.status).toBe(402);
  });

  it('generates a bio with valid key', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'I am a DJ who loves techno.' } }],
        }),
        { status: 200 }
      )
    );

    const res = await POST(
      new NextRequest('https://test.vercel.app/api/ai/generate-bio', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ displayName: 'DJ Test', genres: ['techno'] }),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.bio).toBe('I am a DJ who loves techno.');
  });

  it('returns 500 when OpenAI fails', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { message: 'Rate limited' },
        }),
        { status: 429 }
      )
    );

    const res = await POST(
      new NextRequest('https://test.vercel.app/api/ai/generate-bio', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-jwt' },
        body: JSON.stringify({ displayName: 'DJ Test' }),
      })
    );
    expect(res.status).toBe(429);
  });
});
