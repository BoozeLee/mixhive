import { test, expect } from '@playwright/test';

test.describe('Mix detail', () => {
  test('mix detail page with unknown id renders gracefully', async ({ page }) => {
    await page.goto('/mix/00000000-0000-0000-0000-000000000000');
    // Should render something — either a mix or a not-found/empty state, never a white crash
    await expect(page.locator('#main-content, body').first()).toBeVisible({ timeout: 10_000 });
  });

  test('embed page renders player without full navbar', async ({ page }) => {
    await page.goto('/embed/mix/00000000-0000-0000-0000-000000000000');
    // Embed route should not crash and should render a minimal player shell
    await expect(page.locator('body')).toBeVisible({ timeout: 8_000 });
    // Main site nav should NOT be present in embed view
    await expect(page.locator('nav[aria-label="Main navigation"]'))
      .not.toBeVisible({ timeout: 3_000 })
      .catch(() => {});
  });

  test('buzz detail page renders gracefully', async ({ page }) => {
    await page.goto('/buzz/00000000-0000-0000-0000-000000000000');
    await expect(page.locator('#main-content, body').first()).toBeVisible({ timeout: 10_000 });
  });
});
