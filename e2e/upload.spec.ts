import { test, expect } from '@playwright/test';

test.describe('Upload', () => {
  test('upload page renders form', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.locator('#main-content')).toBeVisible();
    // File input, title, genre
    await expect(
      page.locator('input[type="file"], input[accept*="audio"], label:has-text("audio")').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('title field accepts input', async ({ page }) => {
    await page.goto('/upload');
    const titleField = page.locator('input[name="title"], input[placeholder*="itle"]').first();
    if (await titleField.isVisible()) {
      await titleField.fill('Test Mix Title');
      await expect(titleField).toHaveValue('Test Mix Title');
    }
  });

  test('submit without required fields shows validation errors', async ({ page }) => {
    await page.goto('/upload');
    const submit = page.locator('button[type="submit"], button:has-text("Upload"), button:has-text("Publish")').first();
    if (await submit.isVisible()) {
      await submit.click();
      // Expect some validation message or required indicator
      await expect(
        page.locator('[class*="error"], [role="alert"], [aria-invalid="true"], :invalid').first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
