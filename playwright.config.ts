import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3099';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 35_000,
  },
  projects: [
    // Auth setup — runs once, produces storageState
    {
      name: 'setup',
      testMatch: '**/global-setup.ts',
      teardown: 'cleanup',
    },
    {
      name: 'cleanup',
      testMatch: '**/global-teardown.ts',
    },
    // Desktop
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Tablet
    {
      name: 'Tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 900 },
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Mobile
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Mobile small
    {
      name: 'Mobile Small',
      use: {
        ...devices['Galaxy S8'],
        viewport: { width: 320, height: 740 },
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  // Only start webServer when running locally (not in CI against prod URL)
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run start -- -p 3099',
          url: 'http://localhost:3099',
          reuseExistingServer: true,
          timeout: 30_000,
        },
      }),
});
