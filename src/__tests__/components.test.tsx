import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';

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
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      let button = screen.getByRole('button');
      expect(button).toHaveStyle({ background: 'rgb(240, 192, 64)' });
      expect(button).toHaveStyle({ color: 'rgb(10, 10, 10)' });

      rerender(<Button variant="secondary">Secondary</Button>);
      button = screen.getByRole('button');
      expect(button).toHaveStyle({ background: 'rgb(17, 17, 17)' });
      expect(button).toHaveStyle({ color: 'rgb(238, 238, 238)' });
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
