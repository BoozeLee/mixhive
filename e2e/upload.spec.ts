import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Upload', () => {
  test.beforeEach(() => requireE2EAuth());

  test('upload page renders form', async ({ page }) => {
    await gotoShell(page, '/upload');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(
      page.locator('input[type="file"], input[accept*="audio"], label:has-text("audio")').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('title field accepts input', async ({ page }) => {
    await gotoShell(page, '/upload');
    const titleField = page.locator('input[name="title"], input[placeholder*="itle"]').first();
    if (await titleField.isVisible()) {
      await titleField.fill('Test Mix Title');
      await expect(titleField).toHaveValue('Test Mix Title');
    }
  });

  test('submit without required fields shows validation errors', async ({ page }) => {
    await gotoShell(page, '/upload');
    const submit = page
      .locator('button[type="submit"], button:has-text("Upload"), button:has-text("Publish")')
      .first();
    if (await submit.isVisible()) {
      await submit.click();
      await expect(
        page.locator('[class*="error"], [role="alert"], [aria-invalid="true"], :invalid').first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
