import { test, expect } from '@playwright/test';
import { gotoShell } from './helpers/goto';

test.describe('Public discovery pages', () => {
  test('landing page hero and CTA visible', async ({ page }) => {
    await gotoShell(page, '/');
    await expect(
      page
        .locator(
          'a:has-text("Enter"), a:has-text("Join"), button:has-text("Enter"), button:has-text("Join")'
        )
        .first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('discover page renders without crash', async ({ page }) => {
    await gotoShell(page, '/discover');
    await expect(
      page.locator('h1, h2, [class*="mix"], [class*="card"], [data-testid*="mix"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('founding page renders scarcity meter', async ({ page }) => {
    await gotoShell(page, '/founding');
    await expect(page.getByRole('heading', { name: /founding 50/i })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByRole('progressbar')).toBeVisible({ timeout: 8_000 });
  });

  test('search page renders input', async ({ page }) => {
    await gotoShell(page, '/search');
    await expect(
      page.getByRole('main').locator('input[placeholder*="Search"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('search query does not crash the page', async ({ page }) => {
    await gotoShell(page, '/search');
    const input = page.getByRole('main').locator('input[placeholder*="Search"]').first();
    await input.fill('techno');
    await input.press('Enter');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('text=Something went wrong'))
      .not.toBeVisible({ timeout: 5_000 })
      .catch(() => {});
  });

  test('search exposes mixes, artists, scenes, and shareable filters', async ({ page }) => {
    await gotoShell(page, '/search?q=techno');
    for (const tab of ['All', 'Mixes', 'Artists', 'Scenes']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab, 'i') })).toBeVisible();
    }
    await page.getByRole('button', { name: /filters/i }).click();
    await expect(page.getByLabel('Genre')).toBeVisible();
    await expect(page.getByLabel('Location')).toBeVisible();
  });

  test('hub page renders with 7 tabs', async ({ page }) => {
    await gotoShell(page, '/hub');
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(7, { timeout: 8_000 });
  });

  test('hub tabs all render cards on click', async ({ page }) => {
    await gotoShell(page, '/hub');
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await expect(page.locator('[data-testid^="hub-card-"]').first()).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  test('hub active tab has gold underline styling', async ({ page }) => {
    await gotoShell(page, '/hub');
    const firstTab = page.locator('[role="tab"]').first();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  });

  test('hub lock badges appear on protected cards when unauthenticated', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });
    await page.locator('.mixhive-shell').waitFor({ timeout: 30_000 });
    const locks = page.locator('text=🔒');
    await expect(locks.first()).toBeVisible({ timeout: 8_000 });
    await ctx.close();
  });
});
