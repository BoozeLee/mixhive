// CLI: generate the covering array per class + coverage report, and snapshot
// the model. Emits into hypercube/generated/.
//   node hypercube/generator/index.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CLASSES, TARGETS, DIMENSIONS } from '../model.spec.mjs';
import { generateCoveringArray } from './ipog.mjs';
import { verifyAll } from './coverage.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'generated');
mkdirSync(OUT, { recursive: true });

const targetById = new Map(TARGETS.map(t => [t.id, t]));
const plan = [];
for (const cls of CLASSES) {
  const { dimNames, rows } = generateCoveringArray(cls);
  const cells = rows.map(r => ({
    class: cls.name,
    target: r.target,
    targetMeta: targetById.get(r.target),
    dims: Object.fromEntries(dimNames.filter(n => n !== 'target').map(n => [n, r[n]])),
    pinned: cls.pinned || {},
  }));
  plan.push(...cells);
  writeFileSync(join(OUT, `plan.${cls.name}.json`), JSON.stringify(cells, null, 2) + '\n');
}
writeFileSync(join(OUT, 'plan.all.json'), JSON.stringify(plan, null, 2) + '\n');
writeFileSync(join(OUT, 'model.snapshot.json'),
  JSON.stringify({ DIMENSIONS, CLASSES, TARGETS }, null, 2) + '\n');

const cov = verifyAll();
writeFileSync(join(OUT, 'coverage.json'), JSON.stringify(cov, null, 2) + '\n');

console.log(`Emitted ${plan.length} cells across ${CLASSES.length} classes → hypercube/generated/`);
console.log(`overall ρ=${cov.overallRho.toFixed(4)}  ${cov.ok ? '✓' : '✖'}`);
if (!cov.ok) process.exit(1);
