import { CONSENT_CHANGED_EVENT, hasConsent, saveConsent } from '../lib/consent';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

describe('analytics consent', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults analytics to off and publishes changes immediately', async () => {
    expect(hasConsent('analytics')).toBe(false);
    const listener = jest.fn();
    window.addEventListener(CONSENT_CHANGED_EVENT, listener);

    await saveConsent({ analytics: true, marketing: false });

    expect(hasConsent('analytics')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONSENT_CHANGED_EVENT, listener);
  });
});
