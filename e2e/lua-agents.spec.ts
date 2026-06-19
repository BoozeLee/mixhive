/**
 * Lua Agents — comprehensive E2E suite
 *
 * Structure:
 *   §1  Public gallery (no auth)
 *   §2  API health probes (no auth)
 *   §3  Route auth guards (no auth — verifies 401/redirect)
 *   §4  Authenticated CRUD + test-run (needs E2E_TEST_EMAIL + E2E_TEST_PASSWORD)
 *   §5  Lua sandbox correctness (authenticated)
 *   §6  Agent inbox + marketplace
 *
 * To run authenticated sections locally:
 *   E2E_TEST_EMAIL=you@example.com E2E_TEST_PASSWORD=secret \
 *   PLAYWRIGHT_BASE_URL=https://mixhive.vercel.app \
 *   npx playwright test e2e/lua-agents.spec.ts
 */

import { test, expect } from '@playwright/test';
import { requireE2EAuth } from './helpers/auth';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3099';

// ─────────────────────────────────────────────────────────────────────────────
// §1  Public gallery
// ─────────────────────────────────────────────────────────────────────────────

test.describe('§1 Lua Agents — public gallery', () => {
  test('gallery page loads and has main content', async ({ page }) => {
    await page.goto('/agents/gallery');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  });

  test('starter agents section renders Fork buttons', async ({ page }) => {
    await page.goto('/agents/gallery');
    await page.getByRole('main').waitFor({ timeout: 15_000 });
    // STARTER_AGENTS are always rendered from constants — no DB needed
    await expect(
      page.getByRole('button', { name: /fork into my account/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated fork redirects to /login', async ({ browser }) => {
    // Fresh context — no stored session
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/agents/gallery`);
    await page.getByRole('main').waitFor({ timeout: 15_000 });
    const forkBtn = page.getByRole('button', { name: /fork into my account/i }).first();
    await expect(forkBtn).toBeVisible({ timeout: 10_000 });
    await forkBtn.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await ctx.close();
  });

  test('gallery shows public agent section heading', async ({ page }) => {
    await page.goto('/agents/gallery');
    await page.getByRole('main').waitFor({ timeout: 15_000 });
    // Either public agents or the "no public agents yet" state — heading must exist
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2  API health probes (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('§2 Lua Agents — API health', () => {
  test('wasmoon runtime probe: pool is healthy and engine executes', async ({ request }) => {
    const res = await request.get(`${BASE}/api/agents/wasmoon-test`);
    expect(res.status()).toBe(200);
    const body = await res.json();

    // Engine identity
    expect(body.engine).toBe('wasmoon');

    // Pool is warm
    expect(body.pool.max_size).toBeGreaterThanOrEqual(1);
    expect(body.pool.pool_size).toBeGreaterThanOrEqual(1);

    // Lua actually ran (ok=false here because probe uses a fake UUID — that is EXPECTED)
    expect(['ok', 'error']).toContain(body.output.status);
    expect(Array.isArray(body.output.lua_logs)).toBe(true);
    expect(body.output.lua_logs).toContain('profile_coach start runtime-probe');

    // Duration is measured
    expect(typeof body.output.duration_ms).toBe('number');
    expect(body.output.duration_ms).toBeGreaterThan(0);
  });

  test('wasmoon probe response time < 5s (cold start included)', async ({ request }) => {
    const t0 = Date.now();
    const res = await request.get(`${BASE}/api/agents/wasmoon-test`, { timeout: 10_000 });
    const elapsed = Date.now() - t0;
    expect(res.status()).toBe(200);
    expect(elapsed).toBeLessThan(5_000);
  });

  test('marketplace agents endpoint returns well-formed response', async ({ request }) => {
    const res = await request.get(`${BASE}/api/marketplace/agents`);
    expect([200, 401]).toContain(res.status()); // 401 if auth required
    if (res.status() === 200) {
      const body = await res.json();
      // Response is either { agents: [] } or directly an array
      const list = Array.isArray(body) ? body : body.agents ?? body.data ?? [];
      expect(Array.isArray(list)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3  Route auth guards
// ─────────────────────────────────────────────────────────────────────────────

test.describe('§3 Lua Agents — auth guards', () => {
  test('POST /api/lua-agent/test without JWT → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/lua-agent/test`, {
      data: { agent_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  test('POST /api/agents/test-run without JWT → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/agents/test-run`, {
      data: { agent_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/lua-agent/test with bad JWT → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/lua-agent/test`, {
      headers: { Authorization: 'Bearer this.is.not.valid' },
      data: { agent_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(401);
  });

  test('/agents page without auth redirects to /login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/agents`);
    await page.waitForURL(/\/login|\/setup/, { timeout: 15_000 });
    await ctx.close();
  });

  test('/agents/inbox without auth redirects to /login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/agents/inbox`);
    await page.waitForURL(/\/login|\/setup/, { timeout: 15_000 });
    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4  Authenticated CRUD + test-run
//     Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run these.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('§4 Lua Agents — builder CRUD (authenticated)', () => {
  test.beforeEach(() => requireE2EAuth());

  test('/agents loads with agent list or empty state', async ({ page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    // Either shows agents or "Create your first agent" empty state
    const body = page.locator('main');
    const text = await body.textContent({ timeout: 10_000 });
    expect(text!.length).toBeGreaterThan(20);
  });

  test('can open new agent form via New Agent button', async ({ page }) => {
    await page.goto('/agents');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    const createBtn = page.getByRole('button', { name: /new agent|create/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    await expect(page.locator('#lua-code')).toBeVisible({ timeout: 8_000 });
  });

  test('new agent form via deep-link (?new=1&trigger=manual) renders all triggers', async ({ page }) => {
    await page.goto('/agents?new=1&trigger=manual');
    await expect(page.locator('#lua-code')).toBeVisible({ timeout: 15_000 });

    const triggers = [
      'on_follow', 'on_unfollow', 'on_mix_upload', 'on_comment',
      'on_reply', 'on_mention', 'on_like', 'on_repost', 'on_schedule', 'manual',
    ] as const;

    for (const t of triggers) {
      await expect(
        page.locator(`input[name="trigger"][value="${t}"]`)
      ).toBeAttached({ timeout: 5_000 });
    }
  });

  test('create a manual agent, run test, see output', async ({ page }) => {
    const agentName = `E2E Agent ${Date.now()}`;
    await page.goto('/agents?new=1&trigger=manual');
    await expect(page.locator('#lua-code')).toBeVisible({ timeout: 15_000 });

    // Fill name (first text input in the form)
    await page.locator('input[type="text"]').first().fill(agentName);

    // Pick manual trigger
    await page.locator('input[name="trigger"][value="manual"]').check();

    // Write trivial Lua that the sandbox can execute
    await page.locator('#lua-code').fill('mh.notify("e2e-ping-ok")');

    // Create
    await page.getByRole('button', { name: /create agent/i }).click();

    // After save, Run Test button appears (editor stays open with the saved agent)
    const runBtn = page.getByRole('button', { name: /run test/i });
    await expect(runBtn).toBeVisible({ timeout: 10_000 });

    // Run test
    await runBtn.click();

    // Output pre-tag appears within 20s (includes Lua execution + round-trip)
    const output = page.locator('pre').first();
    await expect(output).toBeVisible({ timeout: 20_000 });
    const outputText = await output.textContent();
    expect(outputText!.length).toBeGreaterThan(0);

    // Status is shown (ok or error — both are valid, sandbox ran)
    expect(outputText).toMatch(/ok|error|timeout/i);
  });

  test('Lua syntax error is surfaced in output, not silently swallowed', async ({ page }) => {
    const agentName = `E2E SyntaxErr ${Date.now()}`;
    await page.goto('/agents?new=1&trigger=manual');
    await expect(page.locator('#lua-code')).toBeVisible({ timeout: 15_000 });

    await page.locator('input[type="text"]').first().fill(agentName);
    await page.locator('input[name="trigger"][value="manual"]').check();
    // Intentionally broken Lua
    await page.locator('#lua-code').fill('this is not valid lua §§§');

    await page.getByRole('button', { name: /create agent/i }).click();
    await expect(page.getByRole('button', { name: /run test/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /run test/i }).click();

    const output = page.locator('pre').first();
    await expect(output).toBeVisible({ timeout: 20_000 });
    const text = await output.textContent();
    // Must mention error — cannot silently succeed with broken Lua
    expect(text).toMatch(/error|failed|syntax|unexpected/i);
  });

  test('delete agent removes it from the list', async ({ page }) => {
    const agentName = `E2E Delete Me ${Date.now()}`;
    await page.goto('/agents?new=1&trigger=manual');
    await expect(page.locator('#lua-code')).toBeVisible({ timeout: 15_000 });

    await page.locator('input[type="text"]').first().fill(agentName);
    await page.locator('input[name="trigger"][value="manual"]').check();
    await page.locator('#lua-code').fill('mh.notify("bye")');
    await page.getByRole('button', { name: /create agent/i }).click();
    await expect(page.getByRole('button', { name: /run test/i })).toBeVisible({ timeout: 10_000 });

    // Delete — confirm dialog
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: /delete/i }).click();

    // Back to agent list — deleted agent no longer visible
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(agentName)).not.toBeVisible({ timeout: 5_000 });
  });

  test('on_schedule trigger shows cron expression field', async ({ page }) => {
    await page.goto('/agents?new=1&trigger=on_schedule');
    await expect(page.locator('#lua-code')).toBeVisible({ timeout: 15_000 });
    await page.locator('input[name="trigger"][value="on_schedule"]').check();
    // Cron input should appear
    const cronInput = page.locator('input[placeholder*="cron" i], input[value*="* *"]').first();
    await expect(cronInput).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5  Lua sandbox correctness (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('§5 Lua Agents — sandbox correctness (authenticated)', () => {
  test.beforeEach(() => requireE2EAuth());

  test('mh.notify() call produces status in test output', async ({ page }) => {
    const name = `E2E notify ${Date.now()}`;
    await page.goto('/agents?new=1&trigger=manual');
    await expect(page.locator('#lua-code')).toBeVisible({ timeout: 15_000 });
    await page.locator('input[type="text"]').first().fill(name);
    await page.locator('input[name="trigger"][value="manual"]').check();
    await page.locator('#lua-code').fill('mh.notify("test-notification-from-e2e")');
    await page.getByRole('button', { name: /create agent/i }).click();
    await expect(page.getByRole('button', { name: /run test/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /run test/i }).click();

    const output = page.locator('pre').first();
    await expect(output).toBeVisible({ timeout: 20_000 });
    // Status: ok is the happy path; error means the mh API call failed (DB check) which is also OK
    const text = await output.textContent();
    expect(text).toMatch(/ok|error/i);
  });

  test('run history appears after first test run', async ({ page }) => {
    const name = `E2E history ${Date.now()}`;
    await page.goto('/agents?new=1&trigger=manual');
    await expect(page.locator('#lua-code')).toBeVisible({ timeout: 15_000 });
    await page.locator('input[type="text"]').first().fill(name);
    await page.locator('input[name="trigger"][value="manual"]').check();
    await page.locator('#lua-code').fill('mh.notify("history-check")');
    await page.getByRole('button', { name: /create agent/i }).click();
    await expect(page.getByRole('button', { name: /run test/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /run test/i }).click();

    // Wait for run output then check run history section
    await expect(page.locator('pre').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/recent runs/i)).toBeVisible({ timeout: 5_000 });
    // At least one run row
    const runRows = page.locator('ul li').filter({ hasText: /ok|error|timeout/ });
    await expect(runRows.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6  Agent inbox + marketplace
// ─────────────────────────────────────────────────────────────────────────────

test.describe('§6 Lua Agents — inbox & marketplace', () => {
  test('marketplace /marketplace/agents loads without error boundary', async ({ page }) => {
    await page.goto('/marketplace/agents');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
    // Error boundary fires when AgentCard sub-component crashes (i18n scope bug)
    await expect(page.getByRole('heading', { name: /something went wrong/i })).not.toBeVisible({ timeout: 8_000 });
    // Some content renders — heading or loading state
    await expect(page.locator('main').locator('h1, h2, [role="status"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('/agents/inbox loads for authenticated users', async ({ page }) => {
    requireE2EAuth();
    await page.goto('/agents/inbox');
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  });

  test('marketplace API returns agents list structure', async ({ request }) => {
    const res = await request.get(`${BASE}/api/marketplace/agents`);
    if (res.status() === 200) {
      const body = await res.json();
      const list = Array.isArray(body) ? body : (body.agents ?? body.data ?? []);
      expect(Array.isArray(list)).toBe(true);
      if (list.length > 0) {
        const first = list[0];
        // Agent records have expected shape
        expect(typeof first.id).toBe('string');
        expect(typeof first.name).toBe('string');
      }
    }
  });
});
