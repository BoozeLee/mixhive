import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Quests & Collab', () => {
  test('collab quests listing loads (public)', async ({ page }) => {
    await gotoShell(page, '/collab-quests');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('collab quests shows cards or empty state', async ({ page }) => {
    await gotoShell(page, '/collab-quests');
    await expect(page.locator('[class*="quest"], [class*="card"], h1, h2, p').first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('my quests list loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/quests');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('new collab quest form loads step 1', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/collab-quests/new');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('input, textarea, h1, h2, form').first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('opportunities page loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/opportunities');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('scene radar page loads (authenticated)', async ({ page }) => {
    requireE2EAuth();
    await gotoShell(page, '/scene-radar');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
