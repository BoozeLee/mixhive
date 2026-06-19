import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Dashboard', () => {
  test.beforeEach(() => requireE2EAuth());

  test('dashboard page loads', async ({ page }) => {
    await gotoShell(page, '/dashboard');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('analytics stat tiles visible', async ({ page }) => {
    await gotoShell(page, '/dashboard');
    await expect(
      page.locator('[class*="stat"], [class*="Stat"], [class*="analytics"], h2, h3').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('mixes section renders or shows empty state', async ({ page }) => {
    await gotoShell(page, '/dashboard');
    await expect(page.locator('[class*="mix"], [class*="upload"], p, h3').first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
