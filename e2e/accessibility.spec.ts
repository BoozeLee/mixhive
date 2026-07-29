import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { gotoShell } from './helpers/goto';
import { hasE2ECredentials } from './helpers/auth';

const PUBLIC_ROUTES = ['/', '/discover', '/search', '/feed', '/login', '/register', '/hub'];

const AUTHED_ROUTES = [
  '/feed',
  '/dashboard',
  '/profile/me',
  '/mix/1',
  '/ai-band',
  '/marketplace/agents',
  '/marketplace/gear',
  '/collab-quests',
  '/leaderboard',
  '/notifications',
];

test.describe('Critical accessibility — public routes', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no serious or critical axe violations`, async ({ page }) => {
      await gotoShell(page, route);
      await page.waitForTimeout(1000);
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        violation => violation.impact === 'critical' || violation.impact === 'serious',
      );
      expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
    });
  }
});

test.describe('Critical accessibility — authed routes', () => {
  test.skip(
    !hasE2ECredentials,
    'E2E account and backend credentials are not configured',
  );

  for (const route of AUTHED_ROUTES) {
    test(`${route} has no serious or critical axe violations`, async ({ page }) => {
      await gotoShell(page, route);
      await page.waitForTimeout(1000);
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        violation => violation.impact === 'critical' || violation.impact === 'serious',
      );
      expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
    });
  }
});
  }
});
