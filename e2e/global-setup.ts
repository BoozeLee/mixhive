import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(dir, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    // Save empty state — authenticated tests will be skipped individually
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  await page.goto('/login');
  await page.waitForSelector('#main-content', { timeout: 15_000 });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to /feed after successful login
  await page.waitForURL('**/feed', { timeout: 15_000 });
  await expect(page.locator('#main-content')).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
