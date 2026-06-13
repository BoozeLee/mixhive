import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';

test.describe('Marketplace', () => {
  test('gear marketplace loads', async ({ page }) => {
    await page.goto('/marketplace/gear');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('gear marketplace shows listings or empty state', async ({ page }) => {
    await page.goto('/marketplace/gear');
    await expect(
      page.locator('[class*="listing"], [class*="card"], [class*="gear"], h1, p').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('agent marketplace loads', async ({ page }) => {
    await page.goto('/marketplace/agents');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });

  test('agent marketplace shows FREE label on free agents', async ({ page }) => {
    await page.goto('/marketplace/agents');
    // Wait for packages to load — may be empty if DB has no data
    const freeLabel = page.getByText('FREE', { exact: true }).first();
    const emptyState = page.getByText('No agents found', { exact: true });
    await expect(freeLabel.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('agent marketplace install button present on free agents', async ({ page }) => {
    await page.goto('/marketplace/agents');
    const installBtn = page.locator('button:has-text("Install")').first();
    const emptyState = page.getByText(/No agents found/i);
    // Either an install button or an empty state is fine
    await expect(installBtn.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('hive story landing renders editorial heading', async ({ page }) => {
    await page.goto('/hive-story');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hive Story', exact: true })).toBeVisible({
      timeout: 8_000,
    });
  });

  test('new gear listing page renders step 1', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/marketplace/gear/new');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 });
  });
});
