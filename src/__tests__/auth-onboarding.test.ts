import { getPostAuthDestination, needsOnboarding } from '../lib/authRouting';
import { OnboardingProfileSchema } from '../lib/schemas';
import type { Profile } from '../lib/types';

const profile: Profile = {
  id: 'profile-1',
  username: 'dj_test',
  display_name: 'DJ Test',
  avatar_url: 'https://example.com/avatar.png',
  banner_url: null,
  bio: 'Underground artist.',
  location: null,
  website: null,
  genres: ['Techno'],
  social_links: {},
  is_dj: true,
  verified: false,
  onboarding_complete: false,
  created_at: '2026-06-11T00:00:00Z',
  updated_at: '2026-06-11T00:00:00Z',
};

describe('authentication onboarding routing', () => {
  it('routes missing and incomplete profiles to setup', () => {
    expect(needsOnboarding(null)).toBe(true);
    expect(needsOnboarding(profile)).toBe(true);
    expect(getPostAuthDestination(null)).toBe('/setup');
    expect(getPostAuthDestination(profile)).toBe('/setup');
  });

  it('routes completed profiles to the feed', () => {
    const complete = { ...profile, onboarding_complete: true };
    expect(needsOnboarding(complete)).toBe(false);
    expect(getPostAuthDestination(complete)).toBe('/feed');
  });
});

describe('required onboarding profile fields', () => {
  const valid = {
    username: 'dj_test',
    displayName: 'DJ Test',
    avatarUrl: 'https://example.com/avatar.png',
    bio: 'Underground artist.',
    genres: ['Techno'],
  };

  it('accepts a complete artist profile', () => {
    expect(OnboardingProfileSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['display name', { ...valid, displayName: '' }],
    ['avatar', { ...valid, avatarUrl: '' }],
    ['bio', { ...valid, bio: '' }],
    ['genre', { ...valid, genres: [] }],
  ])('rejects a profile without %s', (_label, candidate) => {
    expect(OnboardingProfileSchema.safeParse(candidate).success).toBe(false);
  });
});
