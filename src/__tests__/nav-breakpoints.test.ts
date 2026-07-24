import { readFileSync } from 'fs';
import { join } from 'path';

// Regression guard for the "navigation menu is gone" bug: the bottom MobileNav
// and the desktop sidebar are the two nav surfaces on tablet+ widths. If the
// MobileNav retires at a NARROWER breakpoint than the one where the sidebar
// appears, there is a width range with no navigation at all (768–1023px).
// The two crossover breakpoints MUST be equal.

const css = readFileSync(join(__dirname, '../styles/global.css'), 'utf8');

/** The min-width (px) of the media query that governs the first match of `rule`. */
function governingBreakpoint(rule: RegExp): number | null {
  const idx = css.search(rule);
  if (idx === -1) return null;
  const before = css.slice(0, idx);
  const widths = [...before.matchAll(/min-width:\s*(\d+)px/g)];
  return widths.length ? Number(widths[widths.length - 1][1]) : 0;
}

describe('navigation breakpoints', () => {
  it('hides the mobile nav at exactly the width the desktop sidebar appears (no dead zone)', () => {
    const sidebarAppearsAt = governingBreakpoint(
      /\.desktop-sidebar\s*\{[^}]*display:\s*flex/
    );
    const mobileNavHidesAt = governingBreakpoint(/\.mobile-nav\s*\{[^}]*display:\s*none/);

    expect(sidebarAppearsAt).toBe(1024);
    // If these differ, a logged-in user loses all navigation between them.
    expect(mobileNavHidesAt).toBe(sidebarAppearsAt);
  });
});
