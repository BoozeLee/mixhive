import { supabase } from './supabase';

export function getUserVariant(profileId: string, _feature: string): 'control' | 'treatment' {
  // Deterministic assignment: same user always gets same variant per doc 26 spec
  const hash = profileId.replace(/-/g, '').slice(0, 8);
  const bucket = parseInt(hash, 16) % 2;
  return bucket === 0 ? 'treatment' : 'control';
}

export function trackEvent(
  profileId: string,
  eventType: string,
  feature: string,
  properties: Record<string, unknown> = {}
): void {
  const variant = getUserVariant(profileId, feature);
  void supabase
    .from('experiment_events')
    .insert({ profile_id: profileId, event_type: eventType, feature, variant, properties })
    .then(() => {})
    .catch(() => {});
}
