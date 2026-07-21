/**
 * The brand palette lives in two places by necessity:
 *
 *   - `src/styles/tokens.ts`   — read by ~215 components via inline styles
 *   - `src/app/mixhive.css`    — read by shell chrome, honeycomb motifs, keyframes
 *
 * CSS cannot import TypeScript, so the values are duplicated. When they drifted,
 * the same page rendered two different blacks (#0a0a0a vs #030303) and two
 * different golds (#f0c040 vs #f6c400), and the text ramp was neutral grey on one
 * side and warm cream on the other. That mismatch is what made the UI read as
 * flat and inconsistent — the tokens were fine, they just disagreed.
 *
 * This test is the enforcement. It fails if the two ever diverge again.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { colors } from '../styles/tokens';

const css = readFileSync(join(process.cwd(), 'src/app/mixhive.css'), 'utf8');

/** Read a `--custom-property: value;` out of the `:root` block. */
function cssVar(name: string): string | null {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return match?.[1]?.trim().toLowerCase() ?? null;
}

/** Expand `#abc` to `#aabbcc` so short and long hex forms compare equal. */
function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase();
  const m = v.match(/^#([0-9a-f]{3})$/);
  return m?.[1] ? `#${[...m[1]].map(c => c + c).join('')}` : v;
}

describe('brand palette parity: tokens.ts vs mixhive.css', () => {
  const cases: Array<[string, string, string]> = [
    // [label, tokens.ts value, mixhive.css custom property]
    ['page background', colors.bg, 'hive-black'],
    ['panel surface', colors.surface, 'hive-ink'],
    ['brand gold', colors.accent, 'hive-gold'],
    ['primary text', colors.text.primary, 'hive-text'],
    ['secondary text', colors.text.secondary, 'hive-text-soft'],
    ['muted text', colors.text.muted, 'hive-muted'],
    ['faint text', colors.text.faint, 'hive-dim'],
    ['danger', colors.danger, 'hive-danger'],
    ['success', colors.success, 'hive-success'],
  ];

  it.each(cases)('%s matches', (_label, tokenValue, varName) => {
    const fromCss = cssVar(varName);
    expect(fromCss).not.toBeNull();
    expect(normalizeHex(fromCss as string)).toBe(normalizeHex(tokenValue));
  });

  // Old palette values kept turning up hardcoded in files that read neither
  // source: the Next server shells under src/app (error boundary, auth
  // callback, and the [[...slug]] bridge every route renders through) painted
  // themselves #0a0a0a/#eee/#f0c040 long after the tokens moved on. Nothing
  // failed, the pages just quietly disagreed with the app they wrapped.
  it('no superseded palette values survive anywhere in src', () => {
    // Includes the rgb() spelling of the retired gold. Checking hex alone
    // missed 48 sites: the solid gold had moved to #f6c400 while every
    // translucent one — glows, hover fills, borders, shadows — was still
    // rgba(240, 192, 64, α), so a gold edge sat against a gold button and the
    // two visibly disagreed.
    const RETIRED = [
      '#0a0a0a',
      '#f0c040',
      '#030303',
      '#1a1a2e',
      '240, 192, 64',
      '240,192,64',
      '#eee',
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(e.name) && !full.includes('__tests__')) {
          // Strip comments first: the token file and mixhive.css both explain
          // this migration by naming the values they retired, and documenting a
          // dead colour is the opposite of shipping one.
          const text = readFileSync(full, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '')
            .toLowerCase();
          for (const hex of RETIRED) {
            if (text.includes(hex)) {
              offenders.push(`${full.replace(`${process.cwd()}/`, '')} → ${hex}`);
            }
          }
        }
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });

  it('every :root brand colour is a real hex value', () => {
    const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
    const suspicious = [...rootBlock.matchAll(/--hive-[a-z-]+\s*:\s*([^;]+);/g)]
      .map(m => (m[1] ?? '').trim())
      .filter(v => !/^(#[0-9a-fA-F]{3,8}|rgba?\(|var\(|\d)/.test(v));
    expect(suspicious).toEqual([]);
  });
});
