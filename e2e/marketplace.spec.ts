import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Marketplace', () => {
  test('gear marketplace loads', async ({ page }) => {
    await gotoShell(page, '/marketplace/gear');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('gear marketplace shows listings or empty state', async ({ page }) => {
    await gotoShell(page, '/marketplace/gear');
    await expect(
      page.locator('[class*="listing"], [class*="card"], [class*="gear"], h1, p').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('agent marketplace loads', async ({ page }) => {
    await gotoShell(page, '/marketplace/agents');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('agent marketplace shows FREE label on free agents', async ({ page }) => {
    await gotoShell(page, '/marketplace/agents');
    const freeLabel = page.getByText('FREE', { exact: true }).first();
    const emptyState = page.getByText('No agents found', { exact: true });
    await expect(freeLabel.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('agent marketplace install button present on free agents', async ({ page }) => {
    await gotoShell(page, '/marketplace/agents');
    const installBtn = page.locator('button:has-text("Install")').first();
    const emptyState = page.getByText(/No agents found/i);
    await expect(installBtn.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('hive story landing renders editorial heading', async ({ page }) => {
    await gotoShell(page, '/hive-story');
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 8_000 });
  });

  test('new gear listing page renders step 1', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/marketplace/gear/new');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
