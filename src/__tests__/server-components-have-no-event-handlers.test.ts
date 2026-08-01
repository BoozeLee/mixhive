/** @jest-environment node */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Commit 4983fc7 (the P8 a11y sweep) put an inline onFocus/onBlur skip link into
// src/app/layout.tsx, which is a server component. Next 16 throws
// "Event handlers cannot be passed to Client Component props" while serializing
// the RSC payload, so *every* page 500'd: the build succeeded, then the server
// failed to answer a single request. That took down Playwright E2E, Lighthouse
// and Vercel deploys at once, and none of the failures named the real cause.
//
// A server component can never carry a JSX event handler. This walks the .tsx
// files under src/app that are not marked 'use client' and asserts none do.

const APP_DIR = 'src/app';
const HANDLER_PROP = /\son[A-Z]\w*=\{/g;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function isClientComponent(source: string): boolean {
  return /^\s*['"]use client['"]/m.test(source.slice(0, 200));
}

describe('server components under src/app', () => {
  const files = tsxFiles(APP_DIR);

  it('finds .tsx files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s passes no JSX event handlers', file => {
    const source = readFileSync(file, 'utf8');
    if (isClientComponent(source)) return;

    const handlers = source.match(HANDLER_PROP) ?? [];
    expect(handlers).toEqual([]);
  });
});
