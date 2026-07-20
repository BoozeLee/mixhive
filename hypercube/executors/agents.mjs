// Hypercube agent executor — probes each of the 6 AI-agent systems.
// Without CRON_SECRET / a user JWT, authorized-run halves are recorded
// `blocked:no-credential`; public health endpoints and the cron auth-WALL
// (401 without a token) are verified live.
//   node hypercube/executors/agents.mjs [baseUrl]     (default prod)
//   CRON_SECRET=… node hypercube/executors/agents.mjs …   (also runs authorized halves)
import { execSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendCell } from '../lib/results.mjs';

const BASE = process.argv[2] || 'https://mixhive.vercel.app';
const ENV = BASE.includes('vercel.app') || BASE.startsWith('https://') ? 'prod' : 'local';
const CRON = process.env.CRON_SECRET;

async function http(path, { method = 'GET', bearer } = {}) {
  const headers = bearer ? { authorization: `Bearer ${bearer}` } : {};
  try {
    const r = await fetch(BASE + path, { method, headers });
    let body = null;
    try {
      body = await r.json();
    } catch {
      /* non-json */
    }
    return { status: r.status, body };
  } catch (e) {
    return { status: 0, error: String(e) };
  }
}

function record(cls, target, dims, verdict, defect, reason) {
  appendCell({
    class: cls,
    target,
    dims,
    env: ENV,
    verdict,
    oracles: {},
    defect: defect ?? null,
    ...(reason ? { reason } : {}),
  });
  const tag = verdict === 'pass' ? '✓' : verdict === 'blocked' ? '⛔' : '✖';
  console.log(`${tag} ${cls} ${JSON.stringify(dims)} ${defect || reason || ''}`);
}

// 1. Lua (Lupa) — public health GET.
{
  const r = await http('/api/lua-agent/run');
  const ok = r.status === 200 && r.body && (r.body.ok === true || r.body.runtime);
  record(
    'agent-lua',
    'agent:lua',
    { probe: 'health' },
    ok ? 'pass' : 'fail',
    ok ? null : `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 80)}`
  );
}

// 2. Wasmoon (strategic runtime) — public health GET.
{
  const r = await http('/api/agents/wasmoon-test');
  const ok = r.status === 200 && r.body && (r.body.ok !== undefined || r.body.engine);
  record(
    'agent-wasmoon',
    'agent:wasmoon',
    { probe: 'health' },
    ok ? 'pass' : 'fail',
    ok ? null : `status=${r.status}`
  );
}

// 3+4. Cron dispatch — auth WALL (401 without token) is verifiable now;
// authorized run needs CRON_SECRET.
for (const [cls, path] of [
  ['agent-strategic', '/api/cron/strategic-agents'],
  ['agent-notif', '/api/cron/notification-prioritizer'],
]) {
  const noTok = await http(path, { method: 'POST' });
  const wallOk = noTok.status === 401 || noTok.status === 403;
  record(
    cls,
    `api:POST ${path}`,
    { auth: 'anon' },
    wallOk ? 'pass' : 'fail',
    wallOk ? null : `expected 401, got ${noTok.status}`
  );
  if (CRON) {
    const withTok = await http(path, { method: 'POST', bearer: CRON });
    const runOk = withTok.status === 200;
    record(
      cls,
      `api:POST ${path}`,
      { auth: 'completed' },
      runOk ? 'pass' : 'fail',
      runOk ? null : `authorized run status=${withTok.status}`
    );
  } else {
    record(cls, `api:POST ${path}`, { auth: 'completed' }, 'blocked', null, 'no-credential');
  }
}

// 5. Session Spirit — needs a seeded session + creator JWT.
record(
  'agent-session-spirit',
  'agent:session-spirit',
  { probe: 'cooldown' },
  'blocked',
  null,
  'no-credential'
);

// 6. Audio worker — offline Go selftest (if toolchain + a sample present).
{
  const hasGo = (() => {
    try {
      execSync('go version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();
  const sample = ['worker/audio/testdata', 'public/sample.wav'].find(p => existsSync(p));
  if (hasGo && sample) {
    try {
      // sample is from a hardcoded allowlist; execFile (no shell) regardless.
      const out = execFileSync('go', ['run', './worker/audio', '--selftest', sample], {
        encoding: 'utf8',
        timeout: 60000,
      });
      const ok = /selftest ok/i.test(out);
      record(
        'agent-audio',
        'agent:audio-worker',
        { probe: 'selftest' },
        ok ? 'pass' : 'fail',
        ok ? null : out.slice(0, 80)
      );
    } catch (e) {
      record(
        'agent-audio',
        'agent:audio-worker',
        { probe: 'selftest' },
        'fail',
        String(e).slice(0, 80)
      );
    }
  } else {
    record(
      'agent-audio',
      'agent:audio-worker',
      { probe: 'selftest' },
      'blocked',
      null,
      hasGo ? 'no-sample' : 'no-go-toolchain'
    );
  }
}

// 7. AI-Band bridge — provenance publish needs a user JWT.
record(
  'agent-aiband',
  'agent:ai-band-bridge',
  { probe: 'publish' },
  'blocked',
  null,
  'no-credential'
);
