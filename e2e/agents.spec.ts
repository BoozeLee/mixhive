import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';

test.describe('Agents & AI', () => {
  test('agent gallery loads (public)', async ({ page }) => {
    await page.goto('/agents/gallery');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('agent gallery shows agent cards or empty state', async ({ page }) => {
    await page.goto('/agents/gallery');
    await expect(page.locator('[class*="agent"], [class*="card"], h1, h2, p').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('agent builder page loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/agents');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('agent inbox loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/agents/inbox');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('scene radar loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/scene-radar');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });
});
