#!/usr/bin/env node
// Serve the production build locally.
//
// `next start` does NOT work with `output: 'standalone'` (next.config.mjs): it
// mis-serves `/_next/static/chunks/*.js` as `text/plain`/500 → ChunkLoadError and
// the app never hydrates. The standalone build ships its own `server.js`, which
// must run from the standalone root with `.next/static` + `public` assembled
// alongside it — exactly what the Dockerfile does (COPY static -> ./.next/static,
// COPY public -> ./public, `node server.js`). This script reproduces that locally.
//
// Usage: node scripts/preview.mjs [-p <port>]   (default 3000)
//        npm run preview -- -p 3004

import { cpSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const standalone = join(root, '.next', 'standalone');
const serverJs = join(standalone, 'server.js');

if (!existsSync(serverJs)) {
  console.error('No standalone build found at .next/standalone. Run `npm run build` first.');
  process.exit(1);
}

// Parse -p / --port (supports `npm run preview -- -p 3004`); default 3000.
const args = process.argv.slice(2);
let port = process.env.PORT || '3000';
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '-p' || args[i] === '--port') && args[i + 1]) port = args[i + 1];
}
const hostname = process.env.HOSTNAME || '0.0.0.0';

// Assemble static + public into the standalone dir (same as the Dockerfile COPYs).
// Re-copy each run since static filenames are content-hashed per build.
for (const [src, dest] of [
  [join(root, '.next', 'static'), join(standalone, '.next', 'static')],
  [join(root, 'public'), join(standalone, 'public')],
]) {
  if (existsSync(src)) {
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
  }
}

const child = spawn(process.execPath, ['server.js'], {
  cwd: standalone,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port), HOSTNAME: hostname },
});
child.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
