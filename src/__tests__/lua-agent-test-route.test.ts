/**
 * @jest-environment node
 */

// Hermetic: mock supabase (auth + ownership query) and global fetch (the proxy
// hop to the secret-gated Python runner). Mocks live in the factory (hoisting).
jest.mock('@supabase/supabase-js', () => {
  const getUser = jest.fn();
  const maybeSingle = jest.fn();
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  const createClient = jest.fn(() => ({ auth: { getUser }, from }));
  return { createClient, __mocks: { getUser, maybeSingle } };
});

import { POST } from '@/app/api/lua-agent/test/route';
import { NextRequest } from 'next/server';
import * as supa from '@supabase/supabase-js';

const { getUser, maybeSingle } = (
  supa as unknown as { __mocks: { getUser: jest.Mock; maybeSingle: jest.Mock } }
).__mocks;

const fetchMock = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

function req(body: unknown, withAuth = true) {
  return new NextRequest('https://x.test/api/lua-agent/test', {
    method: 'POST',
    headers: withAuth
      ? { authorization: 'Bearer user-jwt', 'content-type': 'application/json' }
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
  maybeSingle.mockReset();
  fetchMock.mockReset();
});

describe('POST /api/lua-agent/test', () => {
  it('401s without an auth header', async () => {
    const res = await POST(req({ agent_id: 'a1' }, false));
    expect(res.status).toBe(401);
  });

  it('401s when the token resolves to no user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const res = await POST(req({ agent_id: 'a1' }));
    expect(res.status).toBe(401);
  });

  it('404s when the caller does not own the agent', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: 'a1', owner_id: 'someone-else', trigger_type: 'manual' } });
    const res = await POST(req({ agent_id: 'a1' }));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies to the runner with the shared secret and returns its result', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: 'a1', owner_id: 'u1', trigger_type: 'on_follow' } });
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ agent_id: 'a1', status: 'ok', duration_ms: 5, stdout: ['hi'], error: null }),
    });

    const res = await POST(req({ agent_id: 'a1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.stdout).toEqual(['hi']);

    // proxied to the Python runner with the secret + test flag + event trigger.
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/lua-agent/run');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer runner-secret');
    const sent = JSON.parse(init.body as string);
    expect(sent.test).toBe(true);
    expect(sent.triggered_by).toBe('event:on_follow');
    expect(sent.event.actor_id).toBe('u1');
  });
});
