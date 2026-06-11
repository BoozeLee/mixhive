/**
 * @jest-environment node
 */

jest.mock('../app/api/ai/_lib/auth', () => ({
  resolveAiContext: jest.fn(),
  noKeyResponse: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { resolveAiContext } from '../app/api/ai/_lib/auth';
import { POST } from '../app/api/ai/generate-avatar/route';

const mockResolveAiContext = resolveAiContext as jest.Mock;
const mockFetch = jest.fn();

function request() {
  return new NextRequest('https://mixhive.test/api/ai/generate-avatar', {
    method: 'POST',
    headers: { authorization: 'Bearer test-session', 'content-type': 'application/json' },
    body: JSON.stringify({ style: 'cosmic-funk', prompt: 'Safe cosmic DJ portrait' }),
  });
}

describe('/api/ai/generate-avatar moderation gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    mockResolveAiContext.mockResolvedValue({
      openaiKey: 'sk-test',
      isAdmin: false,
      isPro: false,
      userId: 'user-1',
    });
  });

  it('generates only after a safe moderation result', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ flagged: false }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: 'https://images.test/avatar.png' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[1]?.[0]).toBe('https://api.openai.com/v1/images/generations');
  });

  it('blocks flagged prompts before generation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ flagged: true }] }),
    });

    const res = await POST(request());

    expect(res.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed when moderation returns a non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const res = await POST(request());

    expect(res.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed when moderation throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network unavailable'));

    const res = await POST(request());

    expect(res.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed when moderation returns a malformed result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const res = await POST(request());

    expect(res.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
