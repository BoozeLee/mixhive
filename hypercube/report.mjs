// Aggregate recorded cells + coverage into report.md + report.json.
//   node hypercube/report.mjs [--assert]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readCells, RESULTS_DIR } from './lib/results.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const cov = existsSync(join(ROOT, 'generated', 'coverage.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'generated', 'coverage.json'), 'utf8'))
  : { results: [], overallRho: 1, rows: 0 };

const cells = readCells();
const by = v => cells.filter(c => c.verdict === v);
const pass = by('pass'), fail = by('fail'), blocked = by('blocked');

// Severity ranking for defects.
function severity(c) {
  const o = c.oracles || {};
  const d = (c.defect || '').toLowerCase();
  if (o.shell === false || /nav\/mount failed|pageerror|500/.test(d)) return 0; // critical: crash/white-screen
  if (o.main === false || o.redirected === false || /did not redirect/.test(d)) return 1; // high: broken/guard
  if (o.axe === false) return 2; // medium: a11y
  if (o.noOverflow === false) return 2; // medium: layout
  return 3; // low
}
const SEV = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const ranked = [...fail].sort((a, b) => severity(a) - severity(b));

function reproCmd(c) {
  if (c.class?.startsWith('agent')) return `node hypercube/executors/agents.mjs`;
  if (c.class?.endsWith('-api')) return `node hypercube/executors/api.mjs`;
  const d = c.dims || {};
  const name = `${c.target} · a=${d.auth ?? 'anon'} d=${d.data} v=${d.viewport} l=${d.locale} m=${d.motion === 'full' ? 'no-preference' : 'reduce'}`;
  const base = c.env === 'prod' ? 'PLAYWRIGHT_BASE_URL=https://mixhive.vercel.app ' : '';
  return `${base}npx playwright test --config hypercube/hypercube.config.ts -g ${JSON.stringify(name)}`;
}

const verdict = fail.length > 0 ? 'FAIL' : blocked.length > 0 ? 'PASS-WITH-GATES' : 'PASS';

// ---- report.json ----
const json = {
  verdict,
  totals: { pass: pass.length, fail: fail.length, blocked: blocked.length, executed: cells.length },
  coverage: { overallRho: cov.overallRho, planRows: cov.rows, perClass: cov.results },
  defects: ranked.map(c => ({ severity: SEV[severity(c)], target: c.target, env: c.env, dims: c.dims, defect: c.defect, repro: reproCmd(c) })),
  blocked: blocked.map(c => ({ target: c.target, env: c.env, dims: c.dims, reason: c.reason })),
};
writeFileSync(join(RESULTS_DIR, 'report.json'), JSON.stringify(json, null, 2) + '\n');

// ---- report.md ----
const L = [];
L.push(`# MixHive Hypercube Verification Report`, '');
L.push(`**Verdict: ${verdict}**  ·  executed ${cells.length} cells → ✅ ${pass.length} pass · ❌ ${fail.length} fail · ⛔ ${blocked.length} blocked(expected-gate)`, '');
L.push(`Model: t=2 pairwise covering array, **overall ρ = ${Number(cov.overallRho).toFixed(4)}** across ${cov.rows} planned cells (see \`generated/coverage.json\`).`, '');

L.push(`## Coverage (ρ per class)`, '', '| class | plan rows | ρ (pairwise) |', '|---|---|---|');
for (const r of cov.results) L.push(`| ${r.class} | ${r.rows} | ${Number(r.rho).toFixed(3)} |`);
L.push('');

L.push(`## Defects (${fail.length}) — ranked`, '');
if (!fail.length) L.push('_None._', '');
else {
  L.push('| sev | target | env | trigger dims | defect | repro |', '|---|---|---|---|---|---|');
  for (const c of ranked) {
    const d = c.dims || {};
    const dimStr = Object.entries(d).map(([k, v]) => `${k}=${v}`).join(' ');
    L.push(`| ${SEV[severity(c)]} | \`${c.target}\` | ${c.env} | ${dimStr} | ${String(c.defect).replace(/\|/g, '\\|').slice(0, 120)} | \`${reproCmd(c).replace(/\|/g, '\\|').slice(0, 90)}\` |`);
  }
  L.push('');
}

L.push(`## Blocked (expected gates / missing creds)`, '');
if (!blocked.length) L.push('_None._', '');
else {
  const byReason = {};
  for (const c of blocked) (byReason[c.reason] ??= []).push(c.target);
  for (const [reason, ts] of Object.entries(byReason)) {
    const uniq = [...new Set(ts)];
    L.push(`- **${reason}** (${ts.length} cells, ${uniq.length} targets): ${uniq.slice(0, 8).join(', ')}${uniq.length > 8 ? '…' : ''}`);
  }
  L.push('');
}

// Per-class executed matrix.
L.push(`## Executed by class`, '', '| class | pass | fail | blocked |', '|---|---|---|---|');
const classes = [...new Set(cells.map(c => c.class))].sort();
for (const cl of classes) {
  const cc = cells.filter(c => c.class === cl);
  L.push(`| ${cl} | ${cc.filter(c => c.verdict === 'pass').length} | ${cc.filter(c => c.verdict === 'fail').length} | ${cc.filter(c => c.verdict === 'blocked').length} |`);
}
L.push('');
L.push(`_Generated ${new Date().toISOString()} from hypercube/results/cells.jsonl_`);

writeFileSync(join(RESULTS_DIR, 'report.md'), L.join('\n') + '\n');
console.log(`Report: ${verdict} — ${pass.length} pass / ${fail.length} fail / ${blocked.length} blocked (${cells.length} executed). → hypercube/results/report.md`);
if (process.argv.includes('--assert') && fail.length > 0) process.exit(1);
