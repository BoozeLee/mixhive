#!/usr/bin/env node
// Hydrated visual smoke: render real app routes headlessly with the bundled
// Playwright Chromium (no system Chrome needed), wait for the client app to
// mount, then check horizontal overflow + console errors and capture
// screenshots at desktop (1440) and mobile (320) widths.
//
// Usage: node scripts/visual_smoke.mjs <baseURL> <route...>
//   node scripts/visual_smoke.mjs http://127.0.0.1:3000 /leaderboard /u/some-dj
//
// Notes:
// - `bypassCSP: true` neutralizes the dev-only missing-`unsafe-eval` CSP so
//   React dev mode can run without any config change.
// - Hydration signal is `#main-content` (rendered by App.tsx once MixHiveClient
//   mounts); the pre-hydration splash is `<main class="hive-boot">` with neither
//   `#main-content` nor `.mixhive-shell`.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseURL = process.argv[2];
const routes = process.argv.slice(3);
if (!baseURL || routes.length === 0) {
  console.error('Usage: node scripts/visual_smoke.mjs <baseURL> <route...>');
  process.exit(2);
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const shotDir = `${repoRoot}/screenshots`;
mkdirSync(shotDir, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 320, height: 740 },
];

// Console noise that is not a real app error: dev HMR, React dev notices, and
// environmental failures reaching external hosts (e.g. an offline sandbox where
// Supabase/analytics DNS can't resolve).
const NOISE =
  /webpack-hmr|eval\(\) is not supported|Download the React DevTools|status of 404|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::ERR_/i;

const overflowFn = () =>
  Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) >
  window.innerWidth + 1;

function slug(route) {
  return route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
}

const browser = await chromium.launch({ executablePath: chromium.executablePath() });
const results = [];
let failed = false;

for (const route of routes) {
  for (const v of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      bypassCSP: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e)));

    let status = null;
    let hydrated = false;
    try {
      const resp = await page.goto(baseURL + route, { waitUntil: 'load', timeout: 45_000 });
      status = resp && resp.status();
      // Wait for the client app to mount (generous: dev first-compile is slow).
      await page.waitForSelector('#main-content', { state: 'attached', timeout: 60_000 });
      hydrated = true;
      // Let lazy route chunk + client data fetch settle.
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1500);
    } catch (e) {
      errors.push('NAV/HYDRATE: ' + e.message);
    }

    const overflow = await page.evaluate(overflowFn).catch(() => 'eval-failed');
    const file = `${shotDir}/visual-${slug(route)}-${v.name}.png`;
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});

    const ok = hydrated && overflow === false && errors.length === 0;
    if (!ok) failed = true;
    results.push({ route, viewport: v.name, status, hydrated, overflow, errors, screenshot: file });
    await ctx.close();
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
console.log(failed ? '\nVISUAL SMOKE: FAILED' : '\nVISUAL SMOKE: PASSED');
process.exit(failed ? 1 : 0);
