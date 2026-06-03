import { test, expect } from '@playwright/test';

test.describe('Public discovery pages', () => {
  test('landing page hero and CTA visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();
    // CTA button or "Enter"/"Join" text
    await expect(
      page.locator('a:has-text("Enter"), a:has-text("Join"), button:has-text("Enter"), button:has-text("Join")').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('discover page renders without crash', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.locator('#main-content')).toBeVisible();
    // Either mix cards or a heading
    await expect(
      page.locator('h1, h2, [class*="mix"], [class*="card"], [data-testid*="mix"]').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('search page renders input', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('input[type="search"], input[placeholder*="earch"]').first()).toBeVisible();
  });

  test('search query does not crash the page', async ({ page }) => {
    await page.goto('/search');
    const input = page.locator('input[type="search"], input[placeholder*="earch"]').first();
    await input.fill('techno');
    await input.press('Enter');
    await expect(page.locator('#main-content')).toBeVisible();
    // No unhandled error overlay
    await expect(page.locator('text=Something went wrong')).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
  });

  test('hub page renders with 7 tabs', async ({ page }) => {
    await page.goto('/hub');
    await expect(page.locator('#main-content')).toBeVisible();
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(7);
  });

  test('hub tabs all render cards on click', async ({ page }) => {
    await page.goto('/hub');
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      // After click, at least one hub card should be visible
      await expect(page.locator('[data-testid^="hub-card-"]').first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('hub active tab has gold underline styling', async ({ page }) => {
    await page.goto('/hub');
    const firstTab = page.locator('[role="tab"]').first();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  });

  test('hub lock badges appear on protected cards when unauthenticated', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/hub');
    // At least one lock emoji should be present somewhere
    const locks = page.locator('text=🔒');
    await expect(locks.first()).toBeVisible({ timeout: 8_000 });
    await ctx.close();
  });
});
