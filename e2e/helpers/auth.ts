import { test } from '@playwright/test';

export const hasE2ECredentials = Boolean(
  process.env.E2E_TEST_EMAIL &&
  process.env.E2E_TEST_PASSWORD &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder.supabase.co') &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-anon-key'
);

export function requireE2EAuth() {
  test.skip(!hasE2ECredentials, 'E2E account and backend credentials are not configured');
}
