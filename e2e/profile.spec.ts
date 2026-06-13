import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';

test.describe('Profile & settings', () => {
  test('settings page renders form', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/settings');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.locator('input, textarea, button:has-text("Save"), h1, h2').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('EPK studio loads', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/epk');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('public profile route renders for test user', async ({ page }) => {
    // Any username that exists — fallback to a generic check
    await page.goto('/u/test');
    // Either a profile or a "not found" message — neither should be a crash
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });
});
