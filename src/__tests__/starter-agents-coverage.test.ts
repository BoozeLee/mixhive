import { STARTER_AGENTS, defaultTemplateFor } from '../lib/starter_agents';

// Every trigger a user can pick in the editor should offer a real starter
// (not the generic one-line fallback), and event-triggered starters must define
// the matching entry-point function or they no-op at runtime.

const EVENT_TRIGGERS = [
  'on_follow',
  'on_comment',
  'on_reply',
  'on_unfollow',
  'on_mix_upload',
  'on_like',
  'on_repost',
  'on_mention',
] as const;

describe('starter agent coverage', () => {
  // Event triggers + on_schedule get a real starter; `manual` uses the built-in
  // defaultTemplateFor fallback by design, so it's excluded here.
  it.each([...EVENT_TRIGGERS, 'on_schedule'])(
    'offers a default starter for %s',
    (trigger: string) => {
      const hasDefault = STARTER_AGENTS.some(
        s => s.trigger_type === trigger && s.default_for_trigger
      );
      expect(hasDefault).toBe(true);
    }
  );

  it.each(EVENT_TRIGGERS)(
    'event starter for %s defines its entry-point function',
    (trigger: string) => {
      for (const s of STARTER_AGENTS.filter(a => a.trigger_type === trigger)) {
        expect(s.lua_code).toContain(`function ${trigger}(`);
      }
    }
  );

  it('every starter has an id, name, description and non-empty code', () => {
    for (const s of STARTER_AGENTS) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.lua_code.trim().length).toBeGreaterThan(0);
    }
  });

  it('starter ids are unique', () => {
    const ids = STARTER_AGENTS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defaultTemplateFor returns the starter body for covered triggers', () => {
    expect(defaultTemplateFor('on_mention')).toContain('function on_mention(');
    expect(defaultTemplateFor('on_unfollow')).toContain('function on_unfollow(');
    expect(defaultTemplateFor('on_mix_upload')).toContain('function on_mix_upload(');
  });
});
