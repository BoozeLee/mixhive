// Standalone Playwright config for the hypercube UI executor. Kept separate
// from the Codex-owned playwright.config.ts. A single chromium project; the
// spec creates a fresh browser context per CELL with the right viewport,
// storageState, reduced-motion and locale cookie, so the covering-array
// dimensions are realized per-cell rather than via fixed projects.
import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3099';

export default defineConfig({
  testDir: './executors',
  outputDir: './.pw-artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Prod is CDN-throttled under burst; serialize more there.
  workers: process.env.PLAYWRIGHT_BASE_URL?.includes('vercel.app') ? 2 : 4,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'only-on-failure',
    navigationTimeout: 35_000,
    actionTimeout: 12_000,
  },
  // Only auto-start a local server when NOT pointed at a remote base URL.
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run preview -- -p 3099',
          url: 'http://127.0.0.1:3099',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
