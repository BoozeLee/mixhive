import { synchronizedPosition, type RitualPlaybackState } from '../lib/rituals';

const state: RitualPlaybackState = {
  session_id: '00000000-0000-4000-8000-000000000001',
  current_asset_id: null,
  playback_status: 'paused',
  anchor_position: 42,
  anchor_timestamp: '2026-06-12T10:00:00.000Z',
  revision: 3,
  agent_enabled: true,
  agent_budget_remaining: 5,
};

describe('ritual synchronized playback', () => {
  afterEach(() => jest.useRealTimers());

  it('keeps paused listeners on the authoritative anchor', () => {
    expect(synchronizedPosition(state)).toBe(42);
  });

  it('advances playing listeners from the authoritative timestamp', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-12T10:00:05.500Z'));
    expect(synchronizedPosition({ ...state, playback_status: 'playing' })).toBe(47.5);
  });
});
