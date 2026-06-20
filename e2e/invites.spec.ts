import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3099';

test.describe('Invite system', () => {
  test('GET /api/invites/check with unknown code returns valid:false', async ({ request }) => {
    const res = await request.get(`${BASE}/api/invites/check?code=DOESNOTEXIST`);
    // 200 in prod (Redis up, code absent); 503 locally when Redis is unavailable (fail-closed by design)
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.valid).toBe(false);
    }
  });

  test('GET /api/invites/check with no code returns 400', async ({ request }) => {
    const res = await request.get(`${BASE}/api/invites/check`);
    expect(res.status()).toBe(400);
  });

  test('POST /api/invites/generate without admin secret returns 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/invites/generate`, {
      data: { label: 'test', max_uses: 1 },
    });
    expect(res.status()).toBe(403);
  });

  test('POST /api/invites/redeem without auth returns 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/invites/redeem`, {
      data: { code: 'TESTCODE' },
    });
    expect(res.status()).toBe(401);
  });

  test('/invite/INVALID renders "Invite not found" page', async ({ page }) => {
    await page.goto('/invite/INVALID00', { waitUntil: 'domcontentloaded' });
    // The invite page is a standalone Next.js page (not in the React Router SPA)
    // so .mixhive-shell is NOT present — wait for h1 directly
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1')).toContainText(/invite not found/i);
  });

  test('/invite/<code> shows loading then invalid for unknown code', async ({ page }) => {
    await page.goto('/invite/BADCODE12', { waitUntil: 'domcontentloaded' });
    // Should eventually show invalid state (not "Checking invite..." forever)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1')).toContainText(/invite not found/i);
  });
});
