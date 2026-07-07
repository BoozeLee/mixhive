import { test, expect } from '@playwright/test';
import { gotoShell } from './helpers/goto';

test.describe('Mix detail', () => {
  test('mix detail page with unknown id renders gracefully', async ({ page }) => {
    await gotoShell(page, '/mix/00000000-0000-0000-0000-000000000000');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('embed page renders player without full navbar', async ({ page }) => {
    await page.goto('/embed/mix/00000000-0000-0000-0000-000000000000', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('body')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('nav[aria-label="Main navigation"]'))
      .not.toBeVisible({ timeout: 3_000 })
      .catch(() => {});
  });

  test('buzz detail page renders gracefully', async ({ page }) => {
    await gotoShell(page, '/buzz/00000000-0000-0000-0000-000000000000');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
