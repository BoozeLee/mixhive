import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = join(process.cwd(), '.next', 'static', 'chunks');
const criticalChunkBytes = 1_500_000;
const warningTotalBytes = 8_000_000;

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(entry => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesIn(path) : Promise.resolve([path]);
    })
  );
  return nested.flat();
}

let files;
try {
  files = (await filesIn(root)).filter(file => file.endsWith('.js'));
} catch {
  console.error('Bundle output missing. Run `npm run build` before `npm run analyze`.');
  process.exit(1);
}

const chunks = await Promise.all(
  files.map(async file => ({ file: relative(process.cwd(), file), bytes: (await stat(file)).size }))
);
chunks.sort((a, b) => b.bytes - a.bytes);
const total = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
const oversized = chunks.filter(chunk => chunk.bytes > criticalChunkBytes);

console.log(`JavaScript chunks: ${chunks.length}; total ${(total / 1_000_000).toFixed(2)} MB`);
for (const chunk of chunks.slice(0, 10)) {
  console.log(`${(chunk.bytes / 1_000).toFixed(0)} KB  ${chunk.file}`);
}
if (total > warningTotalBytes) {
  console.warn(`Warning: total JS exceeds ${(warningTotalBytes / 1_000_000).toFixed(0)} MB.`);
}
if (oversized.length > 0) {
  console.error(`Critical: ${oversized.length} JavaScript chunk(s) exceed 1.5 MB.`);
  process.exit(1);
}
