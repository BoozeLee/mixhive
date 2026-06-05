/**
 * @jest-environment node
 */

// Hermetic: mock the supabase module so importing the (large) api module does not
// touch a real client. The query chain getProfileBadgesFor uses is
// from(...).select(...).in(...).order(...) which resolves to { data }.
// Mocks live inside the factory (jest hoists jest.mock above imports).
jest.mock('@/lib/supabase', () => {
  const order = jest.fn();
  const inFn = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ in: inFn }));
  const from = jest.fn(() => ({ select }));
  return {
    isSupabaseConfigured: true,
    supabase: { from },
    __mocks: { order, inFn, from },
  };
});

import { getProfileBadgesFor } from '@/lib/api';
import * as supa from '@/lib/supabase';

const { order, inFn, from } = (supa as unknown as {
  __mocks: { order: jest.Mock; inFn: jest.Mock; from: jest.Mock };
}).__mocks;

describe('getProfileBadgesFor', () => {
  beforeEach(() => {
    order.mockReset();
    inFn.mockClear();
    from.mockClear();
  });

  it('groups badges by profile_id and dedupes the requested ids', async () => {
    order.mockResolvedValue({
      data: [
        { id: 'b1', profile_id: 'p1', badge_type: 'verified' },
        { id: 'b2', profile_id: 'p1', badge_type: 'trusted_seller' },
        { id: 'b3', profile_id: 'p2', badge_type: 'artist' },
      ],
    });

    const res = await getProfileBadgesFor(['p1', 'p1', 'p2', '']);

    // One batched query, deduped + falsy-filtered ids.
    expect(inFn).toHaveBeenCalledWith('profile_id', ['p1', 'p2']);
    expect(Object.keys(res).sort()).toEqual(['p1', 'p2']);
    expect(res.p1).toHaveLength(2);
    expect(res.p2?.[0]?.badge_type).toBe('artist');
  });

  it('short-circuits with no query when given no ids', async () => {
    const res = await getProfileBadgesFor([]);
    expect(res).toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it('tolerates a null data response', async () => {
    order.mockResolvedValue({ data: null });
    const res = await getProfileBadgesFor(['p9']);
    expect(res).toEqual({});
  });
});
