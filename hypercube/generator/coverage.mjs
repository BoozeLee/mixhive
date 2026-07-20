// Independent pairwise-coverage verifier.
//
// This recomputes, from the model spec alone, the set of all constraint-
// COVERABLE 2-way pairs for each class (by enumerating the valid row space),
// then measures which of those pairs the generated array actually hits:
//     ρ = |covered ∩ coverable| / |coverable|
// It shares only the `forbidden` predicate with the generator; the denominator
// is derived here independently, so a generator bug cannot inflate ρ. Target
// ρ = 1.0 (full pairwise) per class and overall. Also checks every target
// appears ≥ 1 time.

import { CLASSES, classDims, forbidden, TARGETS } from '../model.spec.mjs';
import { cartesian, rowPairs, generateCoveringArray } from './ipog.mjs';

const targetById = new Map(TARGETS.map(t => [t.id, t]));

/** Coverable pairs for a class, derived independently from the spec. */
function coverablePairs(cls) {
  const dims = classDims(cls);
  const dimNames = dims.map(d => d.name);
  const set = new Set();
  for (const r of cartesian(dims)) {
    if (forbidden(r, targetById.get(r.target))) continue;
    for (const p of rowPairs(r, dimNames)) set.add(p);
  }
  return { dimNames, set };
}

/** Verify one class's generated array. */
export function verifyClass(cls) {
  const { dimNames, set: coverable } = coverablePairs(cls);
  const { rows } = generateCoveringArray(cls);

  const covered = new Set();
  const targets = new Set();
  for (const r of rows) {
    targets.add(r.target);
    for (const p of rowPairs(r, dimNames)) if (coverable.has(p)) covered.add(p);
  }
  const allTargets = TARGETS.filter(t => t.class === cls.name).map(t => t.id);
  const missingTargets = allTargets.filter(t => !targets.has(t));

  const rho = coverable.size === 0 ? 1 : covered.size / coverable.size;
  return {
    class: cls.name,
    rows: rows.length,
    coverable: coverable.size,
    covered: covered.size,
    rho,
    targets: allTargets.length,
    missingTargets,
  };
}

export function verifyAll() {
  const results = CLASSES.map(verifyClass);
  const covered = results.reduce((s, r) => s + r.covered, 0);
  const coverable = results.reduce((s, r) => s + r.coverable, 0);
  const rows = results.reduce((s, r) => s + r.rows, 0);
  const overallRho = coverable === 0 ? 1 : covered / coverable;
  const anyMissing = results.some(r => r.missingTargets.length > 0);
  const ok = results.every(r => r.rho >= 1 - 1e-9) && !anyMissing;
  return { results, overallRho, rows, ok };
}

// CLI: `node hypercube/generator/coverage.mjs [--assert]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { results, overallRho, rows, ok } = verifyAll();
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('class', 22), pad('rows', 6), pad('coverable', 10), pad('covered', 8), 'ρ');
  for (const r of results) {
    const flag = r.rho >= 1 - 1e-9 && r.missingTargets.length === 0 ? '' : '  ✖';
    console.log(
      pad(r.class, 22),
      pad(r.rows, 6),
      pad(r.coverable, 10),
      pad(r.covered, 8),
      r.rho.toFixed(3) + flag
    );
    if (r.missingTargets.length) console.log('   missing targets:', r.missingTargets.join(', '));
  }
  console.log('—'.repeat(50));
  console.log(
    `TOTAL rows=${rows}  overall ρ=${overallRho.toFixed(4)}  ${ok ? '✓ pairwise complete' : '✖ INCOMPLETE'}`
  );
  if (process.argv.includes('--assert') && !ok) process.exit(1);
}
