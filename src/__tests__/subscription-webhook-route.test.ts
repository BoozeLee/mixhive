/**
 * @jest-environment node
 */
import { POST } from '@/app/api/subscription/webhook/route';

let upsertRow: Record<string, unknown> | null = null;
let updateResult: { tier: string; status: string } | null = null;
const mockConstructEvent = jest.fn();
let selectData: Record<string, unknown> | null = null;

jest.mock('@/lib/stripe-connect', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mockConstructEvent },
  }),
  makeServiceClient: () => ({
    from: (_table: string) => ({
      upsert: (row: Record<string, unknown>) => {
        upsertRow = row;
        return { onConflict: () => Promise.resolve({ error: null }) };
      },
      select: () => ({
        eq: () => ({
          single: async () => ({ data: selectData, error: selectData ? null : new Error('no') }),
        }),
      }),
      update: (row: { tier: string; status: string }) => {
        updateResult = row;
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  }),
}));

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_PRICE_SUPPORTER = 'price_supporter_123';
  process.env.STRIPE_PRICE_INSIDER = 'price_insider_456';
  process.env.STRIPE_PRICE_PATRON = 'price_patron_789';
});

beforeEach(() => {
  jest.clearAllMocks();
  upsertRow = null;
  updateResult = null;
  selectData = null;
});

function req(body: string, sig?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sig) headers['stripe-signature'] = sig;
  return new Request('http://localhost/api/subscription/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

describe('POST /api/subscription/webhook', () => {
  it('503 when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await POST(req('{}', 'sig') as never);
    expect(res.status).toBe(503);
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
  });

  it('400 when stripe-signature header is missing', async () => {
    const res = await POST(req('{}') as never);
    expect(res.status).toBe(400);
  });

  it('400 when webhook signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Bad signature'); });
    const res = await POST(req('{}', 'bad_sig') as never);
    expect(res.status).toBe(400);
  });

  it('handles customer.subscription.updated — creates/upserts subscription', async () => {
    const subscriptionEvent = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_123',
          status: 'active',
          current_period_end: 1800000000,
          items: { data: [{ price: { id: 'price_insider_456' } }] },
          metadata: { userId: 'u1' },
        },
      },
    };

    mockConstructEvent.mockReturnValue(subscriptionEvent);

    const res = await POST(req(JSON.stringify(subscriptionEvent), 'valid_sig') as never);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(upsertRow).toMatchObject({
      user_id: 'u1',
      tier: 'insider',
      status: 'active',
      stripe_subscription_id: 'sub_1',
    });
  });

  it('handles customer.subscription.deleted — sets tier to free + canceled', async () => {
    const deletedEvent = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_cancel',
          customer: 'cus_123',
          status: 'canceled',
          current_period_end: 1800000000,
          items: { data: [{ price: { id: 'price_insider_456' } }] },
          metadata: { userId: 'u1' },
        },
      },
    };

    mockConstructEvent.mockReturnValue(deletedEvent);

    const res = await POST(req(JSON.stringify(deletedEvent), 'valid_sig') as never);

    expect(res.status).toBe(200);
    expect(updateResult).toEqual({ tier: 'free', status: 'canceled' });
  });

  it('handles invoice.payment_succeeded — sets status to active', async () => {
    selectData = { user_id: 'u1' };
    const invoiceEvent = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_1',
        },
      },
    };

    mockConstructEvent.mockReturnValue(invoiceEvent);

    const res = await POST(req(JSON.stringify(invoiceEvent), 'valid_sig') as never);

    expect(res.status).toBe(200);
    expect(updateResult).toEqual({ status: 'active' });
  });

  it('handles invoice.payment_failed — sets status to past_due', async () => {
    selectData = { user_id: 'u1' };
    const invoiceEvent = {
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: 'sub_1',
        },
      },
    };

    mockConstructEvent.mockReturnValue(invoiceEvent);

    const res = await POST(req(JSON.stringify(invoiceEvent), 'valid_sig') as never);

    expect(res.status).toBe(200);
    expect(updateResult).toEqual({ status: 'past_due' });
  });
});
