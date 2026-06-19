import type { Page } from '@playwright/test';

/**
 * Navigate and wait for the React app to fully mount.
 *
 * Why: the Next.js HTML shell is delivered quickly, but the React JS bundle
 * can take 10-30 s to download and execute on a cold Vercel function edge
 * node — especially when 4 parallel Playwright workers all hit the CDN at
 * once.  Waiting for 'load' (the Playwright default) blocks on all
 * sub-resources including large lazily-fetched JS chunks and risks
 * navigationTimeout.  Instead we:
 *   1. Use 'domcontentloaded' so page.goto() resolves as soon as the HTML
 *      skeleton arrives.
 *   2. Gate on .mixhive-shell which is the React root div written by App.tsx
 *      — its presence proves React has mounted and the router has matched.
 */
export async function gotoShell(
  page: Page,
  url: string,
  timeout = 28_000
): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.mixhive-shell').waitFor({ timeout });
}
