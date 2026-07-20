/**
 * @jest-environment node
 */
import { POST } from '@/app/api/subscription/create/route';

const mockCreateCustomer = jest.fn();
const mockCreateSession = jest.fn();
const mockUser = { id: 'u1', email: 'dj@test.com' };
const mockSelectSingle = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/stripe-connect', () => ({
  getStripe: () => ({
    customers: { create: mockCreateCustomer },
    checkout: { sessions: { create: mockCreateSession } },
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
  mockFrom.mockReturnValue(chain());
});

/** Build a chainable Supabase mock. `select(...).eq(...).single()` or `update(...).eq(...)`. */
function chain() {
  const eq = jest.fn(() => ({
    single: mockSelectSingle,
    // .eq() is also thenable for the .update().eq() path (awaited directly)
    then: (cb: (v: { error: null }) => void) => Promise.resolve(cb({ error: null })),
  }));
  const select = jest.fn(() => ({ eq }));
  const update = jest.fn(() => ({ eq }));
  return { select, update };
}

function req(auth = true, priceId = 'price_insider') {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
  };
  if (auth) headers['authorization'] = 'Bearer jwt';
  return new Request('http://localhost/api/subscription/create', {
    method: 'POST',
    headers,
    body: JSON.stringify({ priceId }),
  });
}

describe('POST /api/subscription/create', () => {
  it('401 without auth', async () => {
    const res = await POST(req(false) as never);
    expect(res.status).toBe(401);
  });

  it('400 when priceId is missing', async () => {
    const headers = { 'content-type': 'application/json', authorization: 'Bearer jwt' };
    const res = await POST(
      new Request('http://localhost/api/subscription/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it('creates a Stripe customer if none exists and returns checkout URL', async () => {
    mockSelectSingle.mockResolvedValue({ data: { stripe_customer_id: null }, error: null });
    mockCreateCustomer.mockResolvedValue({ id: 'cus_new' });
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/session_123' });

    const res = await POST(req() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.com/session_123');
    expect(mockCreateCustomer).toHaveBeenCalledWith({
      email: 'dj@test.com',
      metadata: { userId: 'u1' },
    });
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_new',
        mode: 'subscription',
        line_items: [{ price: 'price_insider', quantity: 1 }],
        metadata: { userId: 'u1' },
      })
    );
  });

  it('reuses existing Stripe customer', async () => {
    mockSelectSingle.mockResolvedValue({
      data: { stripe_customer_id: 'cus_existing' },
      error: null,
    });
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/session_456' });

    const res = await POST(req() as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.com/session_456');
    expect(mockCreateCustomer).not.toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' })
    );
  });
});
