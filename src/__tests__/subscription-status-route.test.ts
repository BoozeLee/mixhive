/**
 * @jest-environment node
 */
import { GET } from '@/app/api/subscription/status/route';

const mockUser = { id: 'u1' };
const mockSubscriptionSelect = jest.fn();

jest.mock('@/lib/stripe-connect', () => ({
  makeUserClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
    from: () => ({
      select: mockSubscriptionSelect,
    }),
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

beforeEach(() => {
  jest.clearAllMocks();
});

function req(auth = true) {
  const headers: Record<string, string> = {};
  if (auth) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/subscription/status', { headers });
}

describe('GET /api/subscription/status', () => {
  it('401 without auth', async () => {
    const res = await GET(req(false) as never);
    expect(res.status).toBe(401);
  });

  it('returns free tier when no subscription exists', async () => {
    mockSubscriptionSelect.mockReturnValue({
      eq: () => ({
        single: async () => ({ data: null, error: { message: 'not found' } }),
      }),
    });

    const res = await GET(req() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tier).toBe('free');
    expect(body.status).toBe('active');
    expect(body.current_period_end).toBeNull();
  });

  it('returns the user subscription when it exists', async () => {
    mockSubscriptionSelect.mockReturnValue({
      eq: () => ({
        single: async () => ({
          data: {
            tier: 'insider',
            status: 'active',
            current_period_end: '2026-08-01T00:00:00Z',
            stripe_subscription_id: 'sub_abc123',
          },
          error: null,
        }),
      }),
    });

    const res = await GET(req() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tier).toBe('insider');
    expect(body.status).toBe('active');
    expect(body.current_period_end).toBe('2026-08-01T00:00:00Z');
    expect(body.stripe_subscription_id).toBe('sub_abc123');
  });
});
