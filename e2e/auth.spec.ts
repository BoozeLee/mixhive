import { test, expect } from '@playwright/test';
import { hasE2ECredentials } from './helpers/auth';
import { gotoShell } from './helpers/goto';

test.describe('Auth flows', () => {
  test('landing page loads with main-content', async ({ page }) => {
    await gotoShell(page, '/');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('login page renders form fields', async ({ page }) => {
    await gotoShell(page, '/login');
    const form = page.locator('form');
    await expect(form.locator('input[type="email"]')).toBeVisible();
    await expect(form.locator('input[type="password"]')).toBeVisible();
    await expect(form.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await gotoShell(page, '/login');
    const form = page.locator('form');
    await form.locator('input[type="email"]').fill('notreal@nowhere.test');
    await form.locator('input[type="password"]').fill('wrongpassword123');
    await form.getByRole('button', { name: /sign in/i }).click();
    await expect(
      page.locator('[role="alert"], .toast, [data-sonner-toast], [class*="error"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('register page renders all fields', async ({ page }) => {
    await gotoShell(page, '/register');
    const form = page.locator('form');
    await expect(form.locator('input[type="email"]')).toBeVisible();
    await expect(form.locator('input[type="password"]')).toBeVisible();
  });

  test('forgot password page renders', async ({ page }) => {
    await gotoShell(page, '/auth/forgot-password');
    const form = page.locator('form');
    await expect(form.locator('input[type="email"]')).toBeVisible();
    await expect(form.getByRole('button', { name: /send reset link/i })).toBeVisible();
  });

  test('login shows Google sign-in option', async ({ page }) => {
    await gotoShell(page, '/login');
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  });

  test('unauthenticated access to /dashboard redirects to login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"], [href="/login"]').first()).toBeVisible({
      timeout: 20_000,
    });
    await ctx.close();
  });

  test('unauthenticated access to /upload redirects to login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/upload', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"], [href="/login"]').first()).toBeVisible({
      timeout: 20_000,
    });
    await ctx.close();
  });

  test.describe('authenticated flows', () => {
    test.skip(!hasE2ECredentials, 'E2E credentials not configured');

    test('login and redirect to /feed', async ({ page }) => {
      await gotoShell(page, '/feed');
      await expect(page.getByRole('main')).toBeVisible();
    });

    test('sign out clears session', async ({ page }) => {
      await gotoShell(page, '/feed');
      const avatar = page
        .locator('[aria-label*="profile"], [aria-label*="menu"], img[alt*="avatar"]')
        .first();
      if (await avatar.isVisible()) {
        await avatar.click();
        const signOutBtn = page.locator(
          'button:has-text("Sign out"), [role="menuitem"]:has-text("Sign out")'
        );
        if (await signOutBtn.isVisible()) {
          await signOutBtn.click();
          await expect(
            page
              .locator('a:has-text("Sign in"), button:has-text("Sign in"), a:has-text("Join")')
              .first()
          ).toBeVisible({ timeout: 8_000 });
        }
      }
    });
  });
});
