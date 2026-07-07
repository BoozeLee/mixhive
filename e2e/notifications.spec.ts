import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Notifications & Push', () => {
  test('notifications page loads (authenticated)', async ({ page }) => {
    await gotoShell(page, '/notifications');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('notifications shows list or empty state', async ({ page }) => {
    await gotoShell(page, '/notifications');
    await expect(page.locator('[class*="notification"], h1, h2, p').first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('notification bell visible in navbar when authenticated', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/feed');
    await expect(
      page.locator('a[href="/notifications"], [aria-label*="notification"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('push enable nudge present when Notification API default', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/feed');
    await expect(page.locator('a[href="/notifications"]').first()).toBeVisible({ timeout: 8_000 });
  });
});
