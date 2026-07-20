// Shared result-recording helpers for all executors.
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RESULTS_DIR = join(ROOT, 'results');
export const CELLS_FILE = join(RESULTS_DIR, 'cells.jsonl');

/** Current environment label from the Playwright base URL / CLI. */
export function envLabel(baseUrl = process.env.PLAYWRIGHT_BASE_URL || '') {
  return baseUrl.includes('vercel.app') || baseUrl.startsWith('https://') ? 'prod' : 'local';
}

/** Append one cell result (single line ≤ PIPE_BUF → atomic across workers). */
export function appendCell(cell) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(CELLS_FILE, JSON.stringify(cell) + '\n');
}

/** Load a generated plan file for a class. */
export function loadPlan(className) {
  return JSON.parse(readFileSync(join(ROOT, 'generated', `plan.${className}.json`), 'utf8'));
}

/** Read all recorded cells (dedup by class|target|dims|env, last wins). */
export function readCells() {
  if (!existsSync(CELLS_FILE)) return [];
  const byKey = new Map();
  for (const line of readFileSync(CELLS_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let c;
    try {
      c = JSON.parse(line);
    } catch {
      continue;
    }
    byKey.set(`${c.class}|${c.target}|${JSON.stringify(c.dims)}|${c.env}`, c);
  }
  return [...byKey.values()];
}
