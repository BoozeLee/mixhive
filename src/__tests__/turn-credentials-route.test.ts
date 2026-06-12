/**
 * @jest-environment node
 */

jest.mock('@/app/api/mythic/sessions/_lib', () => ({
  ritualAuth: jest.fn(),
  ritualRateLimit: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { ritualAuth, ritualRateLimit } from '@/app/api/mythic/sessions/_lib';
import { POST } from '@/app/api/mythic/sessions/[id]/turn-credentials/route';

const mockAuth = ritualAuth as jest.Mock;
const mockRateLimit = ritualRateLimit as jest.Mock;
const sessionId = '00000000-0000-4000-8000-000000000011';
const userId = '00000000-0000-4000-8000-000000000012';

function request(withAuth = true) {
  return new NextRequest(`https://mixhive.test/api/mythic/sessions/${sessionId}/turn-credentials`, {
    method: 'POST',
    headers: withAuth ? { authorization: 'Bearer test' } : {},
  });
}

function context() {
  return { params: Promise.resolve({ id: sessionId }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TURN_CREDENTIALS_ENABLED = 'true';
  process.env.TURN_SHARED_SECRET = 'server-only-secret-at-least-32-bytes';
  process.env.TURN_URLS =
    'turn:turn.mixhive.app:3478?transport=udp,turns:turn.mixhive.app:5349?transport=tcp';
  mockRateLimit.mockResolvedValue(true);
  mockAuth.mockResolvedValue({
    user: { id: userId },
    sb: { rpc: jest.fn().mockResolvedValue({ data: true }) },
  });
});

afterEach(() => {
  delete process.env.TURN_CREDENTIALS_ENABLED;
  delete process.env.TURN_SHARED_SECRET;
  delete process.env.TURN_URLS;
});

describe('POST ritual TURN credentials', () => {
  it('returns 401 for anonymous requests', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await POST(request(false), context())).status).toBe(401);
  });

  it('returns 403 for audience members', async () => {
    mockAuth.mockResolvedValue({
      user: { id: userId },
      sb: { rpc: jest.fn().mockResolvedValue({ data: false }) },
    });
    expect((await POST(request(), context())).status).toBe(403);
  });

  it('returns short-lived credentials without exposing the shared secret', async () => {
    const response = await POST(request(), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body.iceServers[0].username).toContain(userId);
    expect(JSON.stringify(body)).not.toContain('server-only-secret-at-least-32-bytes');
  });

  it('returns 429 when the per-session issuer limit is exceeded', async () => {
    mockRateLimit.mockResolvedValue(false);
    expect((await POST(request(), context())).status).toBe(429);
  });

  it('returns 503 while the relay is disabled', async () => {
    process.env.TURN_CREDENTIALS_ENABLED = 'false';
    expect((await POST(request(), context())).status).toBe(503);
  });
});
