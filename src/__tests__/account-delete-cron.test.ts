/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/account-delete/route';

const mockDeleteUser = jest.fn();
const mockUpdateUserById = jest.fn();
const mockFrom = jest.fn();
const mockStorageFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
        updateUserById: mockUpdateUserById,
      },
    },
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  }),
}));

describe('account-delete cron', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue(createQueryBuilder());
    mockStorageFrom.mockReturnValue(createStorageBuilder());
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  function createQueryBuilder(response: unknown = { data: null, error: null }) {
    const chain: Record<string, unknown> = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      or: jest.fn(() => chain),
      lt: jest.fn(() => chain),
      lte: jest.fn(() => chain),
      in: jest.fn(() => chain),
      neq: jest.fn(() => chain),
      delete: jest.fn(() => chain),
      update: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      maybeSingle: jest.fn(() => Promise.resolve(response)),
      then: jest.fn(cb => Promise.resolve(cb(response))),
    };
    // Make `.select(...)` return the chain so `await` works.
    chain.select.mockReturnValue(chain);
    return chain;
  }

  function createStorageBuilder(response: unknown = { data: [], error: null }) {
    const chain: Record<string, unknown> = {
      list: jest.fn(() => Promise.resolve(response)),
      remove: jest.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return chain;
  }

  function req(auth = true) {
    const headers: Record<string, string> = {};
    if (auth) headers['authorization'] = 'Bearer cron-secret';
    return new NextRequest('https://mixhive.test/api/cron/account-delete', {
      headers,
    });
  }

  it('rejects requests without CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const res = await GET(new NextRequest('https://mixhive.test/api/cron/account-delete'));
    expect(res.status).toBe(401);
  });

  it('rejects requests with wrong bearer token', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const res = await GET(
      new NextRequest('https://mixhive.test/api/cron/account-delete', {
        headers: { authorization: 'Bearer wrong-secret' },
      })
    );
    expect(res.status).toBe(401);
  });

  it('returns 0 when no pending requests are due', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const qb = createQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(qb);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(0);
  });

  it('hard-deletes a user with no retention records and cleans storage', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const userId = 'user-to-delete';
    const requestsQb = createQueryBuilder({
      data: [{ id: 'req-1', user_id: userId }],
      error: null,
    });

    // First .from('deletion_requests') returns requests; second returns retention check.
    mockFrom.mockImplementation((table: string) => {
      if (table === 'deletion_requests') return requestsQb;
      if (table === 'equipment_transactions') {
        return createQueryBuilder({ data: null, error: null, count: 0 });
      }
      if (table === 'user_subscriptions') {
        return createQueryBuilder({ data: null, error: null, count: 0 });
      }
      if (table === 'profiles') {
        return createQueryBuilder({ data: null, error: null });
      }
      return createQueryBuilder();
    });

    mockDeleteUser.mockResolvedValue({ error: null });
    const storage = createStorageBuilder({ data: [], error: null });
    mockStorageFrom.mockReturnValue(storage);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(userId);
    expect(storage.list).toHaveBeenCalledWith(userId, { limit: 100, offset: 0 });
  });

  it('anonymizes a user with marketplace transactions', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const userId = 'user-with-txns';
    const requestsQb = createQueryBuilder({
      data: [{ id: 'req-2', user_id: userId }],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'deletion_requests') return requestsQb;
      if (table === 'equipment_transactions') {
        // Return count > 0 to trigger retention/anonymization path.
        return createQueryBuilder({ data: [{ count: 1 }], error: null, count: 1 });
      }
      if (table === 'user_subscriptions') {
        return createQueryBuilder({ data: null, error: null, count: 0 });
      }
      if (table === 'profiles') {
        return createQueryBuilder({ data: null, error: null });
      }
      return createQueryBuilder();
    });

    mockUpdateUserById.mockResolvedValue({ error: null });
    const storage = createStorageBuilder({ data: [], error: null });
    mockStorageFrom.mockReturnValue(storage);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.anonymized).toBe(1);
    expect(mockUpdateUserById).toHaveBeenCalledWith(userId, {
      email: `deleted+${userId}@mixhive.app`,
      phone: null,
      user_metadata: {},
      app_metadata: {},
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('continues processing remaining users after one failure', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const userId = 'user-fail';
    const requestsQb = createQueryBuilder({
      data: [
        { id: 'req-fail', user_id: userId },
        { id: 'req-ok', user_id: 'user-ok' },
      ],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'deletion_requests') return requestsQb;
      if (table === 'equipment_transactions') {
        return createQueryBuilder({ data: null, error: null, count: 0 });
      }
      if (table === 'user_subscriptions') {
        return createQueryBuilder({ data: null, error: null, count: 0 });
      }
      if (table === 'profiles') {
        return createQueryBuilder({ data: null, error: null });
      }
      return createQueryBuilder();
    });

    mockDeleteUser.mockImplementation((id: string) => {
      if (id === userId) return Promise.resolve({ error: new Error('boom') });
      return Promise.resolve({ error: null });
    });
    mockStorageFrom.mockReturnValue(createStorageBuilder({ data: [], error: null }));

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].userId).toBe(userId);
  });

  it('increments error_count on repeated failures instead of resetting it to 1', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const userId = 'user-fail-again';
    const requestsQb = createQueryBuilder({
      data: [{ id: 'req-fail', user_id: userId }],
      error: null,
    });
    // The row has already failed twice on previous nightly runs.
    const errorCountQb = createQueryBuilder({
      data: { error_count: 2 },
      error: null,
    });

    let deletionRequestsCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'deletion_requests') {
        deletionRequestsCalls += 1;
        // 1st call fetches the due requests; later calls handle the failure path.
        return deletionRequestsCalls === 1 ? requestsQb : errorCountQb;
      }
      if (table === 'equipment_transactions') {
        return createQueryBuilder({ data: null, error: null, count: 0 });
      }
      if (table === 'user_subscriptions') {
        return createQueryBuilder({ data: null, error: null, count: 0 });
      }
      return createQueryBuilder();
    });

    mockDeleteUser.mockResolvedValue({ error: new Error('boom') });
    mockStorageFrom.mockReturnValue(createStorageBuilder({ data: [], error: null }));

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(errorCountQb.update).toHaveBeenCalledWith({ error_count: 3 });
  });
});
