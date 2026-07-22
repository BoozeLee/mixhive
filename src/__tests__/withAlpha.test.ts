import { withAlpha, colors } from '../styles/tokens';

describe('withAlpha', () => {
  it('converts a 6-digit hex + alpha to rgba', () => {
    expect(withAlpha('#f0c040', 0.13)).toBe('rgba(240, 192, 64, 0.13)');
    // Asserted against a literal brand hex before, so moving the accent broke a
    // test of a colour-agnostic helper. withAlpha's job is the conversion, not
    // the palette: check the shape and the alpha, whatever the accent is today.
    expect(withAlpha(colors.accent, 0.5)).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
  });

  it('handles a hex without the leading #', () => {
    expect(withAlpha('000000', 0.6)).toBe('rgba(0, 0, 0, 0.6)');
  });

  it('expands 3-digit shorthand', () => {
    expect(withAlpha('#f55', 0.2)).toBe('rgba(255, 85, 85, 0.2)');
  });
});
