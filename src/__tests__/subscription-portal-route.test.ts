/**
 * @jest-environment node
 */
import { POST } from '@/app/api/subscription/portal/route';

const mockCreatePortalSession = jest.fn();
const mockUser = { id: 'u1' };
const mockSelectSingle = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/stripe-connect', () => ({
  getStripe: () => ({
    billingPortal: { sessions: { create: mockCreatePortalSession } },
  }),
  makeUserClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
  }),
  makeServiceClient: () => ({
    from: mockFrom,
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ single: mockSelectSingle }) }),
  });
});

function req(auth = true) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
  };
  if (auth) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/subscription/portal', { method: 'POST', headers });
}

describe('POST /api/subscription/portal', () => {
  it('401 without auth', async () => {
    const res = await POST(req(false) as never);
    expect(res.status).toBe(401);
  });

  it('400 when no Stripe customer exists', async () => {
    mockSelectSingle.mockResolvedValue({ data: { stripe_customer_id: null }, error: null });

    const res = await POST(req() as never);
    expect(res.status).toBe(400);
  });

  it('returns portal URL when customer exists', async () => {
    mockSelectSingle.mockResolvedValue({
      data: { stripe_customer_id: 'cus_existing' },
      error: null,
    });
    mockCreatePortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/session/portal' });

    const res = await POST(req() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://billing.stripe.com/session/portal');
    expect(mockCreatePortalSession).toHaveBeenCalledWith({
      customer: 'cus_existing',
      return_url: 'http://localhost:3000/settings',
    });
  });
});
