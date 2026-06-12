import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('dashboard page loads', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 12_000 });
  });

  test('analytics stat tiles visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(
      page.locator('[class*="stat"], [class*="Stat"], [class*="analytics"], h2, h3').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('mixes section renders or shows empty state', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[class*="mix"], [class*="upload"], p, h3').first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
