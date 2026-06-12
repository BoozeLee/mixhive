import { test, expect } from '@playwright/test';

test.describe('Agents & AI', () => {
  test('agent gallery loads (public)', async ({ page }) => {
    await page.goto('/agents/gallery');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
  });

  test('agent gallery shows agent cards or empty state', async ({ page }) => {
    await page.goto('/agents/gallery');
    await expect(page.locator('[class*="agent"], [class*="card"], h1, h2, p').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('agent builder page loads (authenticated)', async ({ page }) => {
    await page.goto('/agents');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
  });

  test('agent inbox loads (authenticated)', async ({ page }) => {
    await page.goto('/agents/inbox');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
  });

  test('scene radar loads (authenticated)', async ({ page }) => {
    await page.goto('/scene-radar');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
  });
});
