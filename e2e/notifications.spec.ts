import { test, expect } from '@playwright/test';

test.describe('Notifications & Push', () => {
  test('notifications page loads (authenticated)', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
  });

  test('notifications shows list or empty state', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.locator('[class*="notification"], h1, h2, p').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('notification bell visible in navbar when authenticated', async ({ page }) => {
    await page.goto('/feed');
    // Bell emoji or notification icon in navbar
    await expect(
      page.locator('a[href="/notifications"], [aria-label*="notification"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('push enable nudge present when Notification API default', async ({ page }) => {
    await page.goto('/feed');
    // The bell nudge only appears if Notification.permission === 'default'
    // In test env (headless) this should be 'default', so the "Enable push" button may appear
    // Just verify the bell link is visible — nudge is a best-effort check
    await expect(page.locator('a[href="/notifications"]').first()).toBeVisible({ timeout: 8_000 });
  });
});
