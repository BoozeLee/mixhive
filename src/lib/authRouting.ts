import type { Profile } from './types';

export const DEFAULT_AUTHENTICATED_ROUTE = '/feed';
export const ONBOARDING_ROUTE = '/setup';

export function needsOnboarding(profile: Profile | null): boolean {
  return !profile || profile.onboarding_complete !== true;
}

export function getPostAuthDestination(profile: Profile | null): string {
  return needsOnboarding(profile) ? ONBOARDING_ROUTE : DEFAULT_AUTHENTICATED_ROUTE;
}
