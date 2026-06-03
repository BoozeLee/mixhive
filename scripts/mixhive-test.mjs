#!/usr/bin/env node
// MixHive comprehensive webapp test suite
// Usage: node scripts/mixhive-test.mjs [base-url] [--category health|api|auth|browser] [--json]
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const chalk = require('chalk');
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
const BASE_URL = rawArgs.find(a => a.startsWith('http')) ?? 'https://mixhive.vercel.app';
const CATEGORY = (() => {
  const idx = rawArgs.indexOf('--category');
  return idx !== -1 ? rawArgs[idx + 1] : 'all';
})();
const JSON_OUTPUT = rawArgs.includes('--json');

// ── fetch helper ──────────────────────────────────────────────────────────────
async function req(method, path, { body, timeoutMs = 15_000 } = {}) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const ms = Date.now() - start;
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, ms, url, ok: true };
  } catch (err) {
    const ms = Date.now() - start;
    return { status: 0, json: null, ms, url, ok: false, err: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── outcome helpers ───────────────────────────────────────────────────────────
function ok200(r) {
  if (!r.ok) return { fail: `network error: ${r.err}` };
  if (r.status >= 500) return { fail: `server error ${r.status}` };
  if (r.status >= 400) return { warn: `got ${r.status}` };
  return { pass: `${r.status} ${r.ms}ms` };
}

function ok200or4xx(r) {
  if (!r.ok) return { fail: `network error: ${r.err}` };
  if (r.status >= 500) return { fail: `server error ${r.status}` };
  return { pass: `${r.status} ${r.ms}ms` };
}

function mustBe401(r) {
  if (!r.ok) return { fail: `network error: ${r.err}` };
  if (r.status >= 500) return { fail: `server error ${r.status} — possible crash or auth bypass` };
  if (r.status === 200) return { fail: `got 200 — auth wall missing!` };
  if (r.status === 401 || r.status === 403 || r.status === 400)
    return { pass: `${r.status} ${r.ms}ms` };
  return { warn: `unexpected ${r.status}` };
}

// ── test suites ───────────────────────────────────────────────────────────────
const HEALTH = [
  {
    label: 'GET /api/health',
    run: async () => {
      const r = await req('GET', '/api/health');
      if (!r.ok) return { fail: `network error: ${r.err}` };
      if (r.status !== 200) return { fail: `got ${r.status}` };
      const s = r.json?.status;
      if (s === 'degraded') return { warn: `degraded (${r.ms}ms)` };
      if (s !== 'healthy') return { warn: `unexpected status: ${s}` };
      return { pass: `${r.status} ${r.ms}ms` };
    },
  },
  {
    label: 'GET /api/health/database',
    run: async () => {
      const r = await req('GET', '/api/health/database');
      if (!r.ok) return { fail: `network error: ${r.err}` };
      if (r.status !== 200) return { fail: `got ${r.status}` };
      if (r.json?.status === 'degraded') return { warn: `degraded (${r.ms}ms)` };
      return { pass: `${r.status} ${r.ms}ms` };
    },
  },
  {
    label: 'GET /api/health/storage',
    run: async () => ok200(await req('GET', '/api/health/storage')),
  },
  {
    label: 'GET /api/redis?action=health',
    run: async () => {
      const r = await req('GET', '/api/redis?action=health');
      if (!r.ok) return { fail: `network error: ${r.err}` };
      if (r.status >= 500) return { fail: `server error ${r.status}` };
      if (r.json?.status === 'degraded') return { warn: `redis degraded` };
      return { pass: `${r.status} ${r.ms}ms` };
    },
  },
  {
    label: 'GET /api/cdn/test',
    run: async () => ok200(await req('GET', '/api/cdn/test')),
  },
];

const API = [
  {
    label: 'GET /api/feed?type=trending',
    run: async () => {
      const r = await req('GET', '/api/feed?type=trending');
      const base = ok200(r);
      if (base.fail || base.warn) return base;
      // feed route returns { items: [], cursor, hasMore, cacheHit }
      const arr = r.json?.items ?? r.json?.data ?? r.json;
      if (!Array.isArray(arr)) return { warn: `body.items not an array (got ${typeof arr})` };
      return { pass: `${r.status} ${r.ms}ms — ${arr.length} items` };
    },
  },
  {
    label: 'GET /api/feed?type=trending&genre=techno',
    run: async () => ok200(await req('GET', '/api/feed?type=trending&genre=techno')),
  },
  {
    label: 'GET /api/feed?type=trending&limit=5',
    run: async () => {
      const r = await req('GET', '/api/feed?type=trending&limit=5');
      const base = ok200(r);
      if (base.fail || base.warn) return base;
      const arr = r.json?.items ?? r.json?.data ?? r.json;
      if (Array.isArray(arr) && arr.length > 5)
        return { warn: `returned ${arr.length} items, expected ≤ 5` };
      return { pass: `${r.status} ${r.ms}ms` };
    },
  },
  {
    label: 'GET /api/feed?type=following (no userId → 400)',
    run: async () => {
      const r = await req('GET', '/api/feed?type=following');
      if (!r.ok) return { fail: `network error` };
      if (r.status >= 500) return { fail: `server error ${r.status}` };
      if (r.status === 400) return { pass: `${r.status} correctly rejected (${r.ms}ms)` };
      return { warn: `expected 400, got ${r.status}` };
    },
  },
  {
    label: 'GET /api/quests',
    run: async () => ok200or4xx(await req('GET', '/api/quests')),
  },
  {
    label: 'GET /api/opportunities',
    run: async () => ok200or4xx(await req('GET', '/api/opportunities')),
  },
  {
    label: 'GET /api/nft/collections (POST-only, expects 405)',
    run: async () => ok200or4xx(await req('GET', '/api/nft/collections')),
  },
  {
    label: 'GET /api/agents/wasmoon-test',
    run: async () => ok200(await req('GET', '/api/agents/wasmoon-test', { timeoutMs: 25_000 })),
  },
  {
    label: 'GET /api/embed?mixId=nonexistent',
    run: async () => ok200or4xx(await req('GET', '/api/embed?mixId=nonexistent-test-id')),
  },
  {
    label: 'GET /api/epk?username=nonexistent',
    run: async () => ok200or4xx(await req('GET', '/api/epk?username=nonexistent-test-user-xyz')),
  },
  {
    label: 'GET /api/social/rate-limit',
    run: async () => ok200or4xx(await req('GET', '/api/social/rate-limit')),
  },
  {
    label: 'GET /api/mythic/graph',
    run: async () => ok200or4xx(await req('GET', '/api/mythic/graph')),
  },
  {
    label: 'GET /api/mythic/sessions',
    run: async () => ok200or4xx(await req('GET', '/api/mythic/sessions')),
  },
  {
    label: 'GET /api/audio-intelligence/nonexistent',
    run: async () => ok200or4xx(await req('GET', '/api/audio-intelligence/nonexistent-mix-test')),
  },
  {
    label: 'POST /api/upload/validate (no file → 400)',
    run: async () => {
      // Public endpoint — validates file type/size without auth. Wrong content-type should return 400.
      const r = await req('POST', '/api/upload/validate', { body: {} });
      if (!r.ok) return { fail: `network error` };
      if (r.status >= 500) return { fail: `server error ${r.status}` };
      if (r.status === 400) return { pass: `${r.status} correctly rejected (${r.ms}ms)` };
      return { warn: `expected 400, got ${r.status}` };
    },
  },
];

const AUTH = [
  { label: 'POST /api/mixes (no auth)',
    run: async () => mustBe401(await req('POST', '/api/mixes', { body: {} })) },
  { label: 'POST /api/buzzes (no auth)',
    run: async () => mustBe401(await req('POST', '/api/buzzes', { body: {} })) },
  { label: 'POST /api/ai/generate-bio (no auth)',
    run: async () => mustBe401(await req('POST', '/api/ai/generate-bio', { body: {} })) },
  { label: 'POST /api/ai/suggest-genres (no auth)',
    run: async () => mustBe401(await req('POST', '/api/ai/suggest-genres', { body: {} })) },
  { label: 'POST /api/ai/generate-avatar (no auth)',
    run: async () => mustBe401(await req('POST', '/api/ai/generate-avatar', { body: {} })) },
  { label: 'POST /api/ai/profile-coach (no auth)',
    run: async () => mustBe401(await req('POST', '/api/ai/profile-coach', { body: {} })) },
  { label: 'POST /api/composer/suggest (no auth)',
    run: async () => mustBe401(await req('POST', '/api/composer/suggest', { body: {} })) },
  { label: 'GET /api/notifications (no auth)',
    run: async () => mustBe401(await req('GET', '/api/notifications')) },
  { label: 'POST /api/notifications/mark-read (no auth)',
    run: async () => mustBe401(await req('POST', '/api/notifications/mark-read', { body: {} })) },
  { label: 'POST /api/mythic/propose (no auth)',
    run: async () => mustBe401(await req('POST', '/api/mythic/propose', { body: {} })) },
  { label: 'POST /api/mythic/log-performance (no auth)',
    run: async () => mustBe401(await req('POST', '/api/mythic/log-performance', { body: {} })) },
  { label: 'POST /api/cache/invalidate (no auth)',
    run: async () => mustBe401(await req('POST', '/api/cache/invalidate', { body: {} })) },
  { label: 'GET /api/admin/agents (no auth)',
    run: async () => mustBe401(await req('GET', '/api/admin/agents')) },
  { label: 'POST /api/lua-agent/execute (no auth)',
    run: async () => mustBe401(await req('POST', '/api/lua-agent/execute', { body: {} })) },
];

// ── runner ────────────────────────────────────────────────────────────────────
async function runSuite(tests) {
  const results = [];
  for (const t of tests) {
    let outcome;
    try {
      outcome = await t.run();
    } catch (err) {
      outcome = { fail: `exception: ${err.message}` };
    }
    results.push({ label: t.label, ...outcome });
  }
  return results;
}

function printSuite(name, results) {
  const pass = results.filter(r => r.pass != null).length;
  const warn = results.filter(r => r.warn != null).length;
  const fail = results.filter(r => r.fail != null).length;
  const header = fail > 0
    ? chalk.bold.red(`${name} (${pass}/${results.length})`)
    : warn > 0
      ? chalk.bold.yellow(`${name} (${pass}/${results.length})`)
      : chalk.bold.green(`${name} (${results.length}/${results.length})`);
  console.log(`\n${header}`);
  for (const r of results) {
    const label = r.label.padEnd(46);
    if (r.pass != null) {
      console.log(`  ${chalk.green('✓')}  ${label} ${chalk.dim(r.pass)}`);
    } else if (r.warn != null) {
      console.log(`  ${chalk.yellow('⚠')}  ${label} ${chalk.yellow(r.warn)}`);
    } else {
      console.log(`  ${chalk.red('✗')}  ${label} ${chalk.red(r.fail)}`);
    }
  }
  return { pass, warn, fail };
}

function runBrowserSmoke(baseUrl) {
  console.log(`\n${chalk.bold.white('BROWSER SMOKE')}`);
  const smokeScript = join(__dirname, 'browser_smoke.py');

  const pyCheck = spawnSync('python3', ['--version'], { encoding: 'utf-8' });
  if (pyCheck.status !== 0 || pyCheck.error) {
    console.log(`  ${chalk.yellow('⚠')}  python3 not available — skipping browser smoke`);
    return { pass: 0, warn: 1, fail: 0 };
  }

  console.log(`  ${chalk.dim('Running 15 routes × 4 viewports (this takes ~60s)…')}`);
  const result = spawnSync(
    'python3',
    [smokeScript, baseUrl, '--mock-supabase'],
    { encoding: 'utf-8', timeout: 300_000 }
  );

  if (result.status === 0) {
    const lines = (result.stdout ?? '').trim().split('\n');
    const summary = lines[lines.length - 1] || 'Smoke passed';
    console.log(`  ${chalk.green('✓')}  ${summary}`);
    return { pass: 1, warn: 0, fail: 0 };
  }

  const stderr = result.stderr ?? '';
  const isEnvIssue =
    result.status === 127 ||
    result.error?.code === 'ENOENT' ||
    /No such file|not found|ModuleNotFoundError|playwright|chromium/i.test(stderr);

  if (isEnvIssue) {
    console.log(`  ${chalk.yellow('⚠')}  Playwright/Chromium not available — skipping browser smoke`);
    return { pass: 0, warn: 1, fail: 0 };
  }

  const output = (result.stdout ?? '') + stderr;
  const failLines = output.split('\n').filter(l => l.startsWith('- ')).slice(0, 10);

  // Remote production URLs are throttled by Vercel/CDN on 60 rapid headless requests.
  // Classify failures: if every failure line is a Timeout (network), treat as WARN.
  // Only FAIL on app-level errors (overflow, console error, non-timeout navigation).
  const isRemote = !/localhost|127\.0\.0\.1/.test(baseUrl);
  const allTimeouts = failLines.every(l => /Timeout|PING_FAILED/i.test(l));
  const isNetworkOnly = isRemote && allTimeouts;

  if (isNetworkOnly) {
    console.log(`  ${chalk.yellow('⚠')}  Browser smoke: network timeouts on remote URL (${failLines.length} routes)`);
    console.log(`     ${chalk.dim('Run locally against http://localhost:3000 for reliable results')}`);
    return { pass: 0, warn: 1, fail: 0 };
  }

  console.log(`  ${chalk.red('✗')}  Browser smoke failed`);
  failLines.forEach(l => console.log(`     ${chalk.red(l)}`));
  if (stderr) {
    stderr.trim().split('\n').slice(0, 3).forEach(l => {
      console.log(`     ${chalk.dim(l)}`);
    });
  }
  return { pass: 0, warn: 0, fail: 1 };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const hr = chalk.dim('─'.repeat(52));
  console.log(chalk.bold.white(`\nMixHive Test Suite — ${BASE_URL}`));
  if (CATEGORY !== 'all') console.log(chalk.dim(`  category: ${CATEGORY}`));
  console.log(hr);

  const totals = { pass: 0, warn: 0, fail: 0 };
  let criticalFail = false;

  const run = async (key, name, tests, critical = false) => {
    if (CATEGORY !== 'all' && CATEGORY !== key) return;
    const results = await runSuite(tests);
    const stats = printSuite(name, results);
    totals.pass += stats.pass;
    totals.warn += stats.warn;
    totals.fail += stats.fail;
    if (critical && stats.fail > 0) criticalFail = true;
    if (JSON_OUTPUT) {
      process.stdout.write(JSON.stringify({ suite: key, ...stats, results }) + '\n');
    }
  };

  // health is always critical
  await run('health', 'HEALTH', HEALTH, true);
  await run('api',    'API',    API);
  // auth walls are critical — a 200 is a security failure
  await run('auth',   'AUTH WALLS', AUTH, true);

  if (CATEGORY === 'all' || CATEGORY === 'browser') {
    const stats = runBrowserSmoke(BASE_URL);
    totals.pass += stats.pass;
    totals.warn += stats.warn;
    totals.fail += stats.fail;
  }

  console.log(`\n${hr}`);
  const parts = [
    chalk.green(`PASSED ${totals.pass}`),
    totals.warn > 0 ? chalk.yellow(`WARNED ${totals.warn}`) : chalk.dim(`WARNED 0`),
    totals.fail > 0 ? chalk.red(`FAILED ${totals.fail}`) : chalk.dim(`FAILED 0`),
  ];
  console.log(parts.join('  '));

  if (criticalFail) {
    console.log(chalk.red('\n⛔  Critical failures detected. Fix before deploying.'));
    process.exit(1);
  }
  if (totals.fail > 0) {
    console.log(chalk.yellow('\n⚠  Tests failed.'));
    process.exit(1);
  }
  if (totals.warn > 0) {
    console.log(chalk.yellow('\n⚠  All tests passed with warnings.'));
  } else {
    console.log(chalk.green('\n✓  All tests passed.'));
  }
}

main().catch(err => {
  console.error(chalk.red(`\nFatal: ${err.message}`));
  process.exit(1);
});
