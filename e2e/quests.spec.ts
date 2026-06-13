import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';

test.describe('Quests & Collab', () => {
  test('collab quests listing loads (public)', async ({ page }) => {
    await page.goto('/collab-quests');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('collab quests shows cards or empty state', async ({ page }) => {
    await page.goto('/collab-quests');
    await expect(page.locator('[class*="quest"], [class*="card"], h1, h2, p').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('my quests list loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/quests');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('new collab quest form loads step 1', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/collab-quests/new');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input, textarea, h1, h2, form').first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('opportunities page loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/opportunities');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('scene radar page loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/scene-radar');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });
});
