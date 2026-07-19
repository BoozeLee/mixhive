// Hypercube UI executor — data-driven over the generated covering array.
// Each cell → one browser context realizing its {viewport, motion, locale,
// auth (storageState), data (mock/intercept)} coordinate. Records pass/fail/
// blocked to hypercube/results/cells.jsonl. Run per env:
//   local:  npx playwright test --config hypercube/hypercube.config.ts
//   prod:   PLAYWRIGHT_BASE_URL=https://mixhive.vercel.app npx playwright test --config hypercube/hypercube.config.ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — .mjs sibling, no types
import { appendCell, envLabel, loadPlan } from '../lib/results.mjs';

const ENV = envLabel();
const AUTH_DIR = join(process.cwd(), 'e2e', '.auth');
const stateFor: Record<string, string> = {
  completed: join(AUTH_DIR, 'user.json'),
  admin: join(AUTH_DIR, 'admin.json'),
  'new-incomplete': join(AUTH_DIR, 'incomplete.json'),
};
const VP: Record<string, { width: number; height: number }> = {
  '320': { width: 320, height: 740 },
  '390': { width: 390, height: 844 },
  '768': { width: 768, height: 900 },
  '1440': { width: 1440, height: 900 },
};

interface Cell {
  class: string;
  target: string;
  targetMeta: { path: string; params?: Record<string, string>; oracle?: string };
  dims: Record<string, string>;
  pinned?: Record<string, string>;
}

const CELLS: Cell[] = [
  ...loadPlan('public-ui'),
  ...loadPlan('authed-ui'),
  ...loadPlan('admin-ui'),
];

const auth = (c: Cell) => c.dims.auth ?? c.pinned?.auth ?? 'anon';
const data = (c: Cell) => c.dims.data ?? c.pinned?.data ?? 'empty';

/** The single env where a cell is realizable (see plan §Auth/Data). */
function canonicalEnv(c: Cell): 'local' | 'prod' {
  if (auth(c) !== 'anon') return 'prod'; // real session only on prod
  return data(c) === 'populated' ? 'prod' : 'local';
}

/** Resolve a target path, substituting concrete :param test values. */
function resolvePath(c: Cell): string {
  let p = c.targetMeta.path;
  for (const [k, v] of Object.entries(c.targetMeta.params ?? {})) p = p.replace(`:${k}`, v);
  return p;
}

async function runOracles(page: Page, c: Cell): Promise<{ oracles: Record<string, boolean>; defect: string | undefined }> {
  const oracles: Record<string, boolean> = {};
  let defect: string | undefined;

  // 1. React shell mounted (gotoShell already waited; re-confirm).
  oracles.shell = await page.locator('.mixhive-shell').count() > 0;
  // 2. Main landmark present (or an intentional not-found for the 404 target).
  const isNotFound = c.targetMeta.oracle === 'ui-notfound';
  oracles.main = (await page.locator('#main-content').count()) > 0;
  // 3. No horizontal overflow at this viewport (browser_smoke oracle).
  oracles.noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 2
  );
  // 4. Authed route hit while anon → must redirect to /login (auth guard works).
  if (c.class === 'authed-ui' && auth(c) === 'anon') {
    oracles.redirected = /\/login/.test(page.url());
    if (!oracles.redirected) defect = `authed route ${resolvePath(c)} did not redirect anon → login (url=${page.url()})`;
  }
  // 5. Not-found target renders a not-found state, not a crash.
  if (isNotFound) {
    const txt = (await page.locator('#main-content').innerText().catch(() => '')) || '';
    oracles.notFound = /not found|404|doesn't exist|can't find/i.test(txt) || oracles.main;
  }
  return { oracles, defect };
}

test.describe(`hypercube-ui [${ENV}]`, () => {
  test.describe.configure({ mode: 'parallel' });

  for (const c of CELLS) {
    if (canonicalEnv(c) !== ENV) continue; // realized in the other env
    const a = auth(c);
    const d = data(c);
    const vp = c.dims.viewport ?? '1440';
    const locale = c.dims.locale ?? 'en';
    const motion = (c.dims.motion ?? 'reduced') === 'reduced' ? 'reduce' : 'no-preference';
    const name = `${c.target} · a=${a} d=${d} v=${vp} l=${locale} m=${motion}`;

    test(name, async ({ browser, baseURL }) => {
      // Auth-state realization.
      let storageState: string | undefined;
      if (a !== 'anon') {
        const path = stateFor[a];
        if (!path || !existsSync(path)) {
          appendCell({ class: c.class, target: c.target, dims: c.dims, env: ENV, verdict: 'blocked', reason: 'no-credential', oracles: {} });
          test.skip(true, `no storageState for auth=${a}`);
          return;
        }
        storageState = path;
      }

      const ctxOpts: Parameters<typeof browser.newContext>[0] = {
        viewport: VP[vp],
        reducedMotion: motion as 'reduce' | 'no-preference',
      };
      if (storageState) ctxOpts.storageState = storageState;
      const context: BrowserContext = await browser.newContext(ctxOpts);
      // Locale realization (cookie-based; src/i18n/config.ts LOCALE_COOKIE).
      const origin = new URL(baseURL!).origin;
      await context.addCookies([{ name: 'mh_locale', value: locale, url: origin }]);

      // Data-state realization.
      const page = await context.newPage();
      if (ENV === 'local' && d === 'empty') {
        await page.addInitScript(() => { (window as any).__MIXHIVE_DISABLE_SUPABASE__ = true; });
      }
      if (d === 'error') {
        await page.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{ this is : not json' }));
      }

      const consoleErrors: string[] = [];
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      const pageErrors: string[] = [];
      page.on('pageerror', e => pageErrors.push(String(e)));

      let verdict: 'pass' | 'fail' = 'pass';
      let defect: string | undefined;
      const oracles: Record<string, boolean> = {};
      try {
        await page.goto(resolvePath(c), { waitUntil: 'domcontentloaded' });
        await page.locator('.mixhive-shell').waitFor({ timeout: 28_000 });
        const r = await runOracles(page, c);
        Object.assign(oracles, r.oracles);
        defect = r.defect;

        // Console-noise filter (favicon/analytics/network — not app defects).
        const appErrors = consoleErrors.filter(e =>
          !/favicon|analytics|mixpanel|sentry|Failed to load resource|net::ERR|third-party|manifest\.json/i.test(e)
        );
        oracles.noConsoleError = appErrors.length === 0;
        oracles.noPageError = pageErrors.length === 0;

        // Axe (gated to en to bound runtime; still covers every target×viewport).
        if (locale === 'en') {
          const axe = await new AxeBuilder({ page }).analyze();
          const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
          oracles.axe = serious.length === 0;
          if (serious.length) defect ??= `axe ${serious.length} serious/critical: ${serious.map(v => v.id).join(',')}`;
        }

        // Verdict = all oracles true. Under an INJECTED data=error, a handled
        // console.error (app degrading to an empty state) is expected, so it is
        // recorded but not counted as a failure — we only require graceful
        // render (shell/main/overflow) and no UNCAUGHT pageerror.
        const ignore = data(c) === 'error' ? new Set(['noConsoleError']) : new Set<string>();
        const failed = Object.entries(oracles)
          .filter(([k, v]) => v === false && !ignore.has(k))
          .map(([k]) => k);
        if (failed.length) {
          verdict = 'fail';
          if (!defect) {
            if (!oracles.noConsoleError) defect = `console error: ${appErrors[0]}`;
            else if (!oracles.noPageError) defect = `pageerror: ${pageErrors[0]}`;
            else defect = `oracle failed: ${failed.join(',')}`;
          }
        }
      } catch (e) {
        verdict = 'fail';
        defect = `nav/mount failed: ${e instanceof Error ? e.message : String(e)}`;
        oracles.shell = false;
      } finally {
        appendCell({ class: c.class, target: c.target, dims: c.dims, env: ENV, verdict, oracles, defect: defect ?? null });
        await context.close();
      }

      expect(verdict, defect ?? '').toBe('pass');
    });
  }
});
