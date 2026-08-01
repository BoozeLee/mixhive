#!/usr/bin/env node
// Finds JSX components referenced but never imported or declared in the same file.
//
// Normally tsc catches this. It cannot here: the TypeScript config does not
// type-check (PR #100), and SWC transpiles without resolving identifiers, so
// `<Button>` with no import compiles clean and throws
// "ReferenceError: Button is not defined" at runtime — but only once the branch
// that renders it is reached. 1128c01 shipped exactly that in Feed.tsx, inside
// the feed's error banner: invisible until the feed failed to load, at which
// point the error state crashed the page instead of showing the error.
//
// Usage: node scripts/check-undefined-jsx.mjs   # exit 1 on any finding

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';

// Resolved by React itself rather than by an import.
const BUILTIN = new Set(['Fragment', 'Suspense', 'StrictMode', 'Profiler']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Every name bound at module scope: imports (incl. aliases) and declarations. */
function boundNames(src) {
  const bound = new Set();
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    for (const n of m[1].matchAll(/([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?/g)) {
      bound.add(n[2] ?? n[1]);
    }
  }
  for (const m of src.matchAll(/(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    bound.add(m[1]);
  }
  // Destructured props, including renames: `{ as: Tag = 'span' }`.
  for (const m of src.matchAll(/([A-Za-z0-9_$]+)\s*:\s*([A-Z][A-Za-z0-9_$]*)\s*[=,}]/g)) {
    bound.add(m[2]);
  }
  // Generic type parameters: `<K extends keyof T>(…)`.
  for (const m of src.matchAll(/<\s*([A-Z][A-Za-z0-9_$]*)\s+extends\s/g)) {
    bound.add(m[1]);
  }
  return bound;
}

const findings = [];
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');

  // A generic argument (useState<Tab>, Record<K,V>) glues its `<` to an
  // identifier or a dot; a JSX tag opens after whitespace, a bracket or an
  // operator. The lookbehind is the whole difference between the two.
  const used = new Set();
  for (const m of src.matchAll(/(?<![A-Za-z0-9_$.])<([A-Z][A-Za-z0-9_.]*)[\s/>]/g)) {
    used.add(m[1]);
  }
  if (!used.size) continue;

  const bound = boundNames(src);
  for (const name of used) {
    const root = name.split('.')[0];
    if (BUILTIN.has(root) || bound.has(root)) continue;
    const line = src.slice(0, src.indexOf(`<${name}`)).split('\n').length;
    findings.push(`  ${file}:${line}  <${name}>`);
  }
}

if (findings.length) {
  console.error('✗ JSX components used without an import or declaration:\n');
  console.error(findings.join('\n'));
  console.error(`\n${findings.length} undefined JSX reference(s).`);
  process.exit(1);
}

console.log('✓ No undefined JSX references.');
