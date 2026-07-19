// GDPR consent — localStorage-backed, with best-effort server logging to
// /api/consent. `necessary` is always on; `analytics`/`marketing` are opt-in.
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

export interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  policyVersion: string;
  ts: string;
}

const KEY = 'mixhive_consent_v1';
const POLICY_VERSION = 'v2';
export const CONSENT_CHANGED_EVENT = 'mixhive:consent-changed';

export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ConsentState) : null;
  } catch {
    return null;
  }
}

export function consentDecided(): boolean {
  const c = getConsent();
  if (!c) return false;
  if (c.policyVersion !== POLICY_VERSION) return false;
  return true;
}

export function hasConsent(category: ConsentCategory): boolean {
  const c = getConsent();
  if (!c) return category === 'necessary';
  return !!c[category];
}

export async function saveConsent(choice: {
  analytics: boolean;
  marketing: boolean;
}): Promise<ConsentState> {
  const state: ConsentState = {
    necessary: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
    policyVersion: POLICY_VERSION,
    ts: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota/availability */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: state }));
  // Best-effort server record (attach JWT if signed in); never block the UI.
  try {
    const { supabase } = await import('./supabase');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch('/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        analytics: choice.analytics,
        marketing: choice.marketing,
        policyVersion: POLICY_VERSION,
      }),
    });
  } catch {
    /* offline / not configured — localStorage record still stands */
  }
  return state;
}
