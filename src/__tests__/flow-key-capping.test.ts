import { isCapped, selectCappedCells, type CappingContext } from '@/lib/flow-key/capping';

const BOUNDARY = '2026-07-30T22:00:00.000Z';
const BEFORE = '2026-07-30T21:59:00.000Z';
const AFTER = '2026-07-30T22:00:01.000Z';

function asset(over: Partial<Parameters<typeof isCapped>[0]> = {}) {
  return {
    id: 'a1',
    created_at: BEFORE,
    upload_complete: true,
    deleted_at: null as string | null,
    ...over,
  };
}

const ctx = (over: Partial<CappingContext> = {}): CappingContext => ({
  boundary: BOUNDARY,
  currentAssetId: null,
  playbackStatus: 'paused',
  manuallyCappedIds: [],
  ...over,
});

describe('isCapped', () => {
  it('caps a settled asset created before the boundary', () => {
    expect(isCapped(asset(), ctx())).toBe(true);
  });

  it('refuses an asset created after the boundary', () => {
    expect(isCapped(asset({ created_at: AFTER }), ctx())).toBe(false);
  });

  it('caps an asset created exactly at the boundary (inclusive)', () => {
    expect(isCapped(asset({ created_at: BOUNDARY }), ctx())).toBe(true);
  });

  it('refuses an incomplete upload', () => {
    expect(isCapped(asset({ upload_complete: false }), ctx())).toBe(false);
  });

  it('refuses a soft-deleted asset', () => {
    expect(isCapped(asset({ deleted_at: BEFORE }), ctx())).toBe(false);
  });

  it('REFUSES the take being played right now — the live take is uncapped', () => {
    expect(
      isCapped(asset({ id: 'live' }), ctx({ currentAssetId: 'live', playbackStatus: 'playing' }))
    ).toBe(false);
  });

  it('caps the current asset once playback is paused', () => {
    expect(
      isCapped(asset({ id: 'live' }), ctx({ currentAssetId: 'live', playbackStatus: 'paused' }))
    ).toBe(true);
  });

  it('caps a playing asset the host explicitly capped (the override)', () => {
    expect(
      isCapped(
        asset({ id: 'live' }),
        ctx({ currentAssetId: 'live', playbackStatus: 'playing', manuallyCappedIds: ['live'] })
      )
    ).toBe(true);
  });

  it('does not let a manual cap override the boundary', () => {
    expect(isCapped(asset({ id: 'x', created_at: AFTER }), ctx({ manuallyCappedIds: ['x'] }))).toBe(
      false
    );
  });

  it('does not let a manual cap override an incomplete upload', () => {
    expect(
      isCapped(asset({ id: 'x', upload_complete: false }), ctx({ manuallyCappedIds: ['x'] }))
    ).toBe(false);
  });

  it('does not let a manual cap resurrect a deleted asset', () => {
    expect(
      isCapped(asset({ id: 'x', deleted_at: BEFORE }), ctx({ manuallyCappedIds: ['x'] }))
    ).toBe(false);
  });
});

describe('selectCappedCells', () => {
  it('partitions assets and preserves input order in both groups', () => {
    const result = selectCappedCells(
      [
        asset({ id: 'a' }),
        asset({ id: 'b', created_at: AFTER }),
        asset({ id: 'c' }),
        asset({ id: 'd', upload_complete: false }),
      ],
      ctx()
    );
    expect(result.capped.map(a => a.id)).toEqual(['a', 'c']);
    expect(result.skipped.map(a => a.id)).toEqual(['b', 'd']);
  });

  it('returns empty groups for no assets', () => {
    expect(selectCappedCells([], ctx())).toEqual({ capped: [], skipped: [] });
  });

  it('caps nothing when a single asset is mid-playback', () => {
    const result = selectCappedCells(
      [asset({ id: 'only' })],
      ctx({ currentAssetId: 'only', playbackStatus: 'playing' })
    );
    expect(result.capped).toHaveLength(0);
    expect(result.skipped.map(a => a.id)).toEqual(['only']);
  });
});
