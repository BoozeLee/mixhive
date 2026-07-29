#!/usr/bin/env node
// Raw-hex + rgba tracker for the design-system migration (roadmap P1).
// Reports raw hex literals and raw rgba() strings in src/*.ts(x), excluding
// the token source of truth.
// Usage:
//   node scripts/check-raw-hex.mjs            # report only (exit 0)
//   node scripts/check-raw-hex.mjs --max 200  # fail (exit 1) if total exceeds max

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const EXCLUDE = new Set(['src/styles/tokens.ts']); // the token definitions
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGBA = /rgba\s*\(/g;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const maxArg = process.argv.indexOf('--max');
const max = maxArg > -1 ? Number(process.argv[maxArg + 1]) : null;

const rows = [];
let total = 0;
for (const file of walk(ROOT)) {
  if (EXCLUDE.has(file)) continue;
  const content = readFileSync(file, 'utf8');
  const hexHits = content.match(HEX);
  const rgbaHits = content.match(RGBA);
  const count = (hexHits?.length ?? 0) + (rgbaHits?.length ?? 0);
  if (count) {
    rows.push([count, file]);
    total += count;
  }
}

rows.sort((a, b) => b[0] - a[0]);
for (const [n, file] of rows.slice(0, 25)) console.log(`${String(n).padStart(4)}  ${file}`);
if (rows.length > 25) console.log(`  …and ${rows.length - 25} more files`);
console.log(`\nTotal raw hex+rgba occurrences in ${ROOT}: ${total} across ${rows.length} files`);

if (max != null && total > max) {
  console.error(`\n✗ Raw hex+rgba total ${total} exceeds budget ${max}.`);
  process.exit(1);
}
