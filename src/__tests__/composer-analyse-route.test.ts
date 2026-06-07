/**
 * @jest-environment node
 */

jest.mock('@supabase/supabase-js', () => {
  const getUser = jest.fn();
  const createClient = jest.fn(() => ({ auth: { getUser } }));
  return { createClient, __mocks: { getUser } };
});

import { POST } from '@/app/api/composer/analyse/route';
import { NextRequest } from 'next/server';
import * as supa from '@supabase/supabase-js';

const { getUser } = (supa as unknown as { __mocks: { getUser: jest.Mock } }).__mocks;
const fetchMock = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

function req(body: unknown, withAuth = true) {
  return new NextRequest('https://x.test/api/composer/analyse', {
    method: 'POST',
    headers: withAuth
      ? { authorization: 'Bearer jwt', 'content-type': 'application/json' }
      : { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.LUA_RUNTIME_SHARED_SECRET = 'runner-secret';
});

beforeEach(() => {
  getUser.mockReset();
  fetchMock.mockReset();
});

describe('POST /api/composer/analyse', () => {
  it('401s without a JWT', async () => {
    const res = await POST(req({ mix_ids: ['m1', 'm2', 'm3'] }, false));
    expect(res.status).toBe(401);
  });

  it('400s when mix_ids is empty', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await POST(req({ mix_ids: [] }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies to /api/lua-agent/execute with the secret and returns suggestions', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        output: { suggestions: [{ suggestion_type: 'set_analysis', payload: { analysis: 'nice arc', mix_count: 3 } }] },
      }),
    });

    const res = await POST(req({ mix_ids: ['m1', 'm2', 'm3'], bpm_map: { m1: 128 } }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions[0].payload.analysis).toBe('nice arc');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/lua-agent/execute');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer runner-secret');
    const sent = JSON.parse(init.body as string);
    expect(sent.agent_id).toBe('set_composer_agent');
    expect(sent.profile_id).toBe('u1');
    expect(sent.context.mix_ids).toEqual(['m1', 'm2', 'm3']);
  });
});
