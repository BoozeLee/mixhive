import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Profile & settings', () => {
  test('settings page renders form', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/settings');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.locator('input, textarea, button:has-text("Save"), h1, h2').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('EPK studio loads', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/epk');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('public profile route renders for test user', async ({ page }) => {
    await gotoShell(page, '/u/test');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
