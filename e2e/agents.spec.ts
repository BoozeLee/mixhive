import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Agents & AI', () => {
  test('agent gallery loads (public)', async ({ page }) => {
    await gotoShell(page, '/agents/gallery');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('agent gallery shows agent cards or empty state', async ({ page }) => {
    await gotoShell(page, '/agents/gallery');
    await expect(page.locator('[class*="agent"], [class*="card"], h1, h2, p').first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('agent builder page loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/agents');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('agent inbox loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/agents/inbox');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('scene radar loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/scene-radar');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
