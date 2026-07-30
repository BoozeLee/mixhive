/**
 * The P1 hex→token sweep (1128c01) rewrote hundreds of literal style values
 * into token references. Four of those references pointed at keys that were
 * never added:
 *
 *   - `getAgentCategoryColor` and `layout`  → build failure (10 Turbopack errors)
 *   - `transition.smooth` (×4 call sites)   → `transition: undefined`, animation dead
 *   - `space[15]`                           → `undefinedpx`, padding declaration dropped
 *
 * The first pair broke loudly. The second pair broke silently — nothing failed,
 * the UI just quietly stopped animating and lost its gutters. Neither tsc (which
 * cannot run in this repo), nor ESLint, nor the test suite caught them.
 *
 * This test walks src and asserts every `token.key` / `token[i]` reference
 * resolves against the real export. It is the enforcement that was missing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import * as tokens from '../styles/tokens';

// Token objects whose members are referenced from components as `name.key`
// or `name[index]`. `colors` is excluded: it is nested (colors.text.muted).
const SCALES = [
  'space',
  'fontSize',
  'fontWeight',
  'radius',
  'shadow',
  'transition',
  'blur',
  'bp',
  'layout',
] as const;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !full.includes('__tests__')) out.push(full);
  }
  return out;
}

describe('every token reference in src resolves to a real key', () => {
  const files = sourceFiles(join(process.cwd(), 'src'));

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(SCALES)('%s', scale => {
    const target = (tokens as unknown as Record<string, Record<string, unknown>>)[scale];
    expect(target).toBeDefined();
    const valid = new Set(Object.keys(target));
    const offenders: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const rel = file.replace(`${process.cwd()}/`, '');

      // name[0] / name[15]
      for (const m of text.matchAll(new RegExp(`\\b${scale}\\[(\\d+)\\]`, 'g'))) {
        if (!valid.has(m[1] as string)) offenders.push(`${rel} → ${scale}[${m[1]}]`);
      }
      // name.key — skip property access on something else (theme.space.x), and
      // skip module paths like './layout.tsx', which are not token references.
      const FILE_EXT = /^(tsx?|jsx?|mjs|cjs|css|json|svg)$/;
      for (const m of text.matchAll(new RegExp(`(^|[^\\w./'"\`])${scale}\\.(\\w+)`, 'g'))) {
        const key = m[2] as string;
        if (FILE_EXT.test(key)) continue;
        if (!valid.has(key)) offenders.push(`${rel} → ${scale}.${key}`);
      }
    }

    expect([...new Set(offenders)]).toEqual([]);
  });

  it('keeps the four keys the sweep referenced but never defined', () => {
    expect(tokens.transition.smooth).toBe('250ms ease');
    expect(tokens.space[15]).toBe(96);
    expect(typeof tokens.getAgentCategoryColor).toBe('function');
    expect(tokens.layout.contentMaxWidth).toBe(640);
  });
});
