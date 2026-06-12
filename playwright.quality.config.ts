import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['accessibility.spec.ts', 'mobile.spec.ts'],
  outputDir: './e2e-quality-results',
  fullyParallel: true,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3099',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: 'accessibility.spec.ts',
    },
    {
      name: 'Mobile Small',
      use: { ...devices['Galaxy S8'], viewport: { width: 320, height: 740 } },
      testMatch: 'mobile.spec.ts',
    },
  ],
  webServer: {
    command: 'npm run start -- -p 3099',
    url: 'http://127.0.0.1:3099',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
