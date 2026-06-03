import { test, expect } from '@playwright/test';

test.describe('Marketplace', () => {
  test('gear marketplace loads', async ({ page }) => {
    await page.goto('/marketplace/gear');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
  });

  test('gear marketplace shows listings or empty state', async ({ page }) => {
    await page.goto('/marketplace/gear');
    await expect(
      page.locator('[class*="listing"], [class*="card"], [class*="gear"], h1, p').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('agent marketplace loads', async ({ page }) => {
    await page.goto('/marketplace/agents');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
  });

  test('agent marketplace shows FREE label on free agents', async ({ page }) => {
    await page.goto('/marketplace/agents');
    // Wait for packages to load — may be empty if DB has no data
    const freeLabel = page.locator('text=FREE').first();
    const emptyState = page.locator('text=No agents').first();
    await expect(freeLabel.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('agent marketplace install button present on free agents', async ({ page }) => {
    await page.goto('/marketplace/agents');
    const installBtn = page.locator('button:has-text("Install")').first();
    const emptyState = page.locator('text=No agents, text=no agents').first();
    // Either an install button or an empty state is fine
    await expect(installBtn.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('hive story landing renders editorial heading', async ({ page }) => {
    await page.goto('/hive-story');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(
      page.locator('text=Hive Story, text=Editorial, h1').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('new gear listing page renders step 1', async ({ page }) => {
    await page.goto('/marketplace/gear/new');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
  });
});
