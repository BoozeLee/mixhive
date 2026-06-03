import { test, expect } from '@playwright/test';

test.describe('Feed', () => {
  test('feed page loads with main-content', async ({ page }) => {
    await page.goto('/feed');
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('tab switcher is visible', async ({ page }) => {
    await page.goto('/feed');
    // Look for tab-like elements (Trending / Feed / Latest)
    const tabs = page.locator('[role="tab"], button:has-text("Trending"), button:has-text("Feed"), button:has-text("Latest")');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
  });

  test('feed renders mix cards or empty state', async ({ page }) => {
    await page.goto('/feed');
    await expect(
      page.locator('[data-testid*="mix"], [class*="mix-card"], [class*="MixCard"], h3, p').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('buzz composer textarea is present', async ({ page }) => {
    await page.goto('/feed');
    await expect(
      page.locator('textarea[placeholder*="buzz"], textarea[placeholder*="Buzz"], textarea[placeholder*="What"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('trending tab click does not crash', async ({ page }) => {
    await page.goto('/feed');
    const trending = page.locator('button:has-text("Trending"), [role="tab"]:has-text("Trending")').first();
    if (await trending.isVisible()) {
      await trending.click();
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });

  test('latest tab click does not crash', async ({ page }) => {
    await page.goto('/feed');
    const latest = page.locator('button:has-text("Latest"), [role="tab"]:has-text("Latest")').first();
    if (await latest.isVisible()) {
      await latest.click();
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });
});
