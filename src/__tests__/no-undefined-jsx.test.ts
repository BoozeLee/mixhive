/** @jest-environment node */
import { execFileSync } from 'node:child_process';

// scripts/check-undefined-jsx.mjs is wired in here rather than into the CI
// workflow, because .github/workflows is Codex-owned (CLAUDE.md → Agent
// Ownership) and the jest suite already runs on every PR.
//
// It guards a gap tsc would normally cover: type-checking does not run in this
// repo (PR #100), and SWC transpiles without resolving identifiers, so a JSX
// component used with no import builds clean and throws ReferenceError at
// runtime. 1128c01 shipped that in Feed.tsx's error banner — the crash only
// reachable once the feed had already failed.

describe('undefined JSX references', () => {
  it('finds none anywhere in src', () => {
    expect(() =>
      execFileSync('node', ['scripts/check-undefined-jsx.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe',
      })
    ).not.toThrow();
  });
});
