import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { colors } from '@/styles/tokens';

/** Token hex -> the `rgb(r, g, b)` form jsdom reports for a computed style. */
function rgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map(c => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

describe('Components', () => {
  describe('LoadingSpinner', () => {
    it('should render loading spinner', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('should accept custom size', () => {
      render(<LoadingSpinner size="sm" />);
      const spinner = screen.getByRole('status');
      const indicator = spinner.firstElementChild;
      expect(indicator).toHaveClass('h-4');
      expect(indicator).toHaveClass('w-4');
    });
  });

  describe('Button', () => {
    it('should render button with correct text', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
    });

    it('should handle different variants', () => {
      // Expectations derive from the tokens rather than hard-coding brand hex.
      // These previously asserted literal rgb(240, 192, 64) / rgb(17, 17, 17),
      // so a deliberate palette change failed the suite while telling us
      // nothing about the button. What matters is the mapping — primary paints
      // itself in the accent on the page background, secondary in the panel
      // surface — not which hex the accent happens to be this quarter.
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      let button = screen.getByRole('button');
      expect(button).toHaveStyle({ background: rgb(colors.accent) });
      expect(button).toHaveStyle({ color: rgb(colors.bg) });

      rerender(<Button variant="secondary">Secondary</Button>);
      button = screen.getByRole('button');
      expect(button).toHaveStyle({ background: rgb(colors.surface) });
      expect(button).toHaveStyle({ color: rgb(colors.text.primary) });
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: /disabled/i });
      expect(button).toBeDisabled();
    });

    it('should handle loading state', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button', { name: /loading/i });
      expect(button).toBeDisabled();
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });
  });
});
