import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { gotoShell } from './helpers/goto';

const PUBLIC_ROUTES = ['/', '/discover', '/search', '/feed'];

test.describe('Critical accessibility', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no serious or critical axe violations`, async ({ page }) => {
      await gotoShell(page, route);
      await expect(page.getByRole('main')).toBeAttached();
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        violation => violation.impact === 'critical' || violation.impact === 'serious'
      );
      expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
    });
  }
});
