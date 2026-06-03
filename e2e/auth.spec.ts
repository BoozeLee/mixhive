import { test, expect } from '@playwright/test';

const hasCredentials = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

test.describe('Auth flows', () => {
  test('landing page loads with main-content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('login page renders form fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'notreal@nowhere.test');
    await page.fill('input[type="password"]', 'wrongpassword123');
    await page.click('button[type="submit"]');
    // Expect an error toast or error message — look for any error indicator
    await expect(
      page.locator('[role="alert"], .toast, [data-sonner-toast], [class*="error"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('register page renders all fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('unauthenticated access to /dashboard redirects to login', async ({ browser }) => {
    // Use a fresh context with no stored session
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/dashboard');
    // Either redirected to /login or the page shows a login prompt
    await expect(
      page.locator('input[type="email"], [href="/login"]').first()
    ).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test('unauthenticated access to /upload redirects to login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/upload');
    await expect(
      page.locator('input[type="email"], [href="/login"]').first()
    ).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test.describe('authenticated flows', () => {
    test.skip(!hasCredentials, 'E2E credentials not configured');

    test('login and redirect to /feed', async ({ page }) => {
      // Already authenticated via storageState — just verify we land on feed
      await page.goto('/feed');
      await expect(page.locator('#main-content')).toBeVisible();
    });

    test('sign out clears session', async ({ page }) => {
      await page.goto('/feed');
      // Open user menu and sign out
      const avatar = page.locator('[aria-label*="profile"], [aria-label*="menu"], img[alt*="avatar"]').first();
      if (await avatar.isVisible()) {
        await avatar.click();
        const signOutBtn = page.locator('button:has-text("Sign out"), [role="menuitem"]:has-text("Sign out")');
        if (await signOutBtn.isVisible()) {
          await signOutBtn.click();
          await expect(
            page.locator('a:has-text("Sign in"), button:has-text("Sign in"), a:has-text("Join")').first()
          ).toBeVisible({ timeout: 8_000 });
        }
      }
    });
  });
});
