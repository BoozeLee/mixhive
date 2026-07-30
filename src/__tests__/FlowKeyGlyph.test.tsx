import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowKeyGlyph } from '@/components/FlowKeyGlyph';

describe('FlowKeyGlyph', () => {
  it('renders a real button for a host who can turn it', () => {
    render(<FlowKeyGlyph capped={3} skipped={2} isOpen={false} canTurn onTurn={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('states the capped count in plain language, no jargon', () => {
    render(<FlowKeyGlyph capped={3} skipped={2} isOpen={false} canTurn onTurn={() => {}} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/3 of 5 cells capped/i);
  });

  it('renders a non-interactive status glyph for the audience', () => {
    render(
      <FlowKeyGlyph capped={3} skipped={2} isOpen={false} canTurn={false} onTurn={() => {}} />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('announces the drain politely while open, never blocking', () => {
    render(<FlowKeyGlyph capped={3} skipped={0} isOpen canTurn={false} onTurn={() => {}} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/comb draining/i);
  });

  it('calls onTurn when the host activates it', async () => {
    const onTurn = jest.fn();
    render(<FlowKeyGlyph capped={1} skipped={0} isOpen={false} canTurn onTurn={onTurn} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it('disables the turn when nothing is capped, and says why', () => {
    render(<FlowKeyGlyph capped={0} skipped={2} isOpen={false} canTurn onTurn={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(/nothing's capped yet/i);
  });

  it('disables the turn while a drain is already open', () => {
    render(<FlowKeyGlyph capped={3} skipped={0} isOpen canTurn onTurn={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables the turn while busy', () => {
    render(<FlowKeyGlyph capped={3} skipped={0} isOpen={false} canTurn busy onTurn={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
