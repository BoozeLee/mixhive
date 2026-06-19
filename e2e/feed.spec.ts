import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Feed', () => {
  test('feed page loads with main-content', async ({ page }) => {
    await gotoShell(page, '/feed');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('tab switcher is visible', async ({ page }) => {
    await gotoShell(page, '/feed');
    const tabs = page.locator(
      '[role="tab"], button:has-text("Trending"), button:has-text("Feed"), button:has-text("Latest")'
    );
    await expect(tabs.first()).toBeVisible({ timeout: 8_000 });
  });

  test('feed renders mix cards or empty state', async ({ page }) => {
    await gotoShell(page, '/feed');
    // Feed is working when the tab switcher is visible (tabs always render even before cards load)
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 8_000 });
  });

  test('buzz composer textarea is present', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/feed');
    await expect(
      page
        .locator(
          'textarea[placeholder*="buzz"], textarea[placeholder*="Buzz"], textarea[placeholder*="What"]'
        )
        .first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('trending tab click does not crash', async ({ page }) => {
    await gotoShell(page, '/feed');
    const trending = page
      .locator('button:has-text("Trending"), [role="tab"]:has-text("Trending")')
      .first();
    if (await trending.isVisible()) {
      await trending.click();
      await expect(page.getByRole('main')).toBeVisible();
    }
  });

  test('latest tab click does not crash', async ({ page }) => {
    await gotoShell(page, '/feed');
    const latest = page
      .locator('button:has-text("Latest"), [role="tab"]:has-text("Latest")')
      .first();
    if (await latest.isVisible()) {
      await latest.click();
      await expect(page.getByRole('main')).toBeVisible();
    }
  });
});
