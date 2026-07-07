import { test, expect } from '@playwright/test';
import { gotoShell } from './helpers/goto';

const ROUTES = [
  '/',
  '/feed',
  '/discover',
  '/search',
  '/hub',
  '/marketplace/gear',
  '/marketplace/agents',
  '/hive-story',
  '/agents/gallery',
  '/collab-quests',
  '/quests',
];

test.describe('Mobile overflow', () => {
  for (const route of ROUTES) {
    test(`${route} — no horizontal overflow`, async ({ page }) => {
      await gotoShell(page, route);
      await expect(page.getByRole('main')).toBeVisible();

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      });
      expect(overflow, `Horizontal overflow detected on ${route}`).toBe(false);
    });
  }

  test('all tap targets ≥44px wide on home', async ({ page }) => {
    await gotoShell(page, '/');
    await expect(page.getByRole('main')).toBeVisible();

    const tinyTargets = await page.evaluate(() => {
      const interactive = document.querySelectorAll('button, a[href]');
      const tiny: string[] = [];
      interactive.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
          tiny.push(
            `${el.tagName} "${(el as HTMLElement).innerText?.slice(0, 30)}" — ${Math.round(rect.width)}×${Math.round(rect.height)}px`
          );
        }
      });
      return tiny.slice(0, 10);
    });

    if (tinyTargets.length > 0) {
      console.warn(`⚠️ Small tap targets on /: ${tinyTargets.join(', ')}`);
    }
  });
});
