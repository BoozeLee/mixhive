// Covering-array generator (greedy set-cover construction).
//
// For a relevance class we build the pool of all constraint-VALID full rows,
// then greedily select rows to cover every 2-way (pairwise) combination that
// appears in that pool. Greedy set cover over the valid pool is guaranteed to
// reach 100% pairwise coverage (every coverable pair lives in some pool row),
// while producing far fewer rows than the full product. A post-pass guarantees
// every target level appears at least once. Deterministic (stable tie-breaks).
//
// The generated array's coverage is proven SEPARATELY by coverage.mjs, which
// recomputes the coverable denominator from scratch.

import { classDims, forbidden, TARGETS } from '../model.spec.mjs';

/** Cartesian product of [{name, levels}] → array of {name:level} rows. */
export function cartesian(dims) {
  let rows = [{}];
  for (const d of dims) {
    const next = [];
    for (const r of rows) for (const lv of d.levels) next.push({ ...r, [d.name]: lv });
    rows = next;
  }
  return rows;
}

/** Unordered 2-dim pair keys present in a row, e.g. "auth=anon|data=empty". */
export function rowPairs(row, dimNames) {
  const keys = [];
  for (let i = 0; i < dimNames.length; i++)
    for (let j = i + 1; j < dimNames.length; j++) {
      const a = dimNames[i],
        b = dimNames[j];
      keys.push(`${a}=${row[a]}|${b}=${row[b]}`);
    }
  return keys;
}

const targetById = new Map(TARGETS.map(t => [t.id, t]));

/** Build the pool of constraint-valid full rows for a class. */
export function validRows(cls) {
  const dims = classDims(cls);
  return cartesian(dims).filter(r => !forbidden(r, targetById.get(r.target)));
}

/**
 * Generate a t=2 covering array for a class.
 * @returns {{dimNames:string[], rows:object[], coverablePairCount:number}}
 */
export function generateCoveringArray(cls) {
  const dims = classDims(cls);
  const dimNames = dims.map(d => d.name);
  const pool = validRows(cls);

  // Coverable pairs = union of pairs over the valid pool.
  const coverable = new Set();
  const poolPairs = pool.map(r => {
    const ps = rowPairs(r, dimNames);
    ps.forEach(p => coverable.add(p));
    return ps;
  });

  const uncovered = new Set(coverable);
  const chosen = [];
  const usedTargets = new Set();

  // Greedy set cover over the pool.
  while (uncovered.size > 0) {
    let best = -1,
      bestGain = -1;
    for (let i = 0; i < pool.length; i++) {
      let gain = 0;
      for (const p of poolPairs[i]) if (uncovered.has(p)) gain++;
      if (gain > bestGain) {
        bestGain = gain;
        best = i;
      }
    }
    if (best < 0 || bestGain <= 0) break; // safety (shouldn't happen)
    chosen.push(pool[best]);
    usedTargets.add(pool[best].target);
    for (const p of poolPairs[best]) uncovered.delete(p);
  }

  // Post-pass: ensure every target appears at least once (covers 0-pair classes).
  for (const r of pool) {
    if (!usedTargets.has(r.target)) {
      chosen.push(r);
      usedTargets.add(r.target);
    }
  }

  return { dimNames, rows: chosen, coverablePairCount: coverable.size };
}
