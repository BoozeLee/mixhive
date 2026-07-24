// The strategic-agent endpoint can return a 200 without the notifications/
// suggestions/tasks arrays. Consumers (SceneRadar, Opportunities) dereference
// .length/.map directly, so runStrategicAgent must guarantee the arrays exist —
// otherwise the whole view crashes to a blank page.

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  },
}));

import { runStrategicAgent } from '../lib/agents';

describe('runStrategicAgent array normalization', () => {
  it('defaults missing array fields to [] so consumers cannot crash', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
      text: async () => '',
    }) as unknown as typeof fetch;

    const out = await runStrategicAgent('scene_radar', {}, true);
    expect(out.notifications).toEqual([]);
    expect(out.suggestions).toEqual([]);
    expect(out.tasks).toEqual([]);
  });

  it('preserves arrays the endpoint does return', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        notifications: [{ channel: 'scene', subject: 's', body: 'b' }],
        suggestions: [],
        tasks: [],
      }),
      text: async () => '',
    }) as unknown as typeof fetch;

    const out = await runStrategicAgent('scene_radar');
    expect(out.notifications).toHaveLength(1);
  });
});
