import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SporeCard } from '@/components/SporeCard';
import type { FlowSpore } from '@/lib/rituals';

const spore = (over: Partial<FlowSpore> = {}): FlowSpore => ({
  id: 'sp1',
  session_id: 'se1',
  state: 'sealed',
  sealed_at: '2026-07-30T22:00:00.000Z',
  generation: 0,
  content_hash: 'abcdef0123456789'.repeat(4),
  parent_hash: null,
  capped_count: 3,
  skipped_count: 2,
  carbon_count: 2,
  silica_count: 1,
  germination_count: 0,
  is_mine: true,
  ...over,
});

describe('SporeCard', () => {
  it('states the capped ratio in plain language', () => {
    render(<SporeCard spore={spore()} onGerminate={jest.fn()} />);
    expect(screen.getByText(/3 of 5 cells capped/i)).toBeInTheDocument();
  });

  it('labels a generation-0 spore as drained from a ritual', () => {
    render(<SporeCard spore={spore()} onGerminate={jest.fn()} />);
    expect(screen.getByText(/drained from a ritual/i)).toBeInTheDocument();
  });

  it('names the generation for descended spores', () => {
    render(<SporeCard spore={spore({ generation: 2 })} onGerminate={jest.fn()} />);
    expect(screen.getByText(/generation 2/i)).toBeInTheDocument();
  });

  it('declares the carbon and silica split openly', () => {
    render(<SporeCard spore={spore()} onGerminate={jest.fn()} />);
    expect(screen.getByText(/2 humans · 1 machine/i)).toBeInTheDocument();
  });

  it('omits the machine fraction entirely when there is none', () => {
    render(<SporeCard spore={spore({ silica_count: 0, carbon_count: 1 })} onGerminate={jest.fn()} />);
    expect(screen.getByText(/1 human/i)).toBeInTheDocument();
    expect(screen.queryByText(/machine/i)).not.toBeInTheDocument();
  });

  it('shows how many times it has been grown, once it has', () => {
    render(<SporeCard spore={spore({ germination_count: 3 })} onGerminate={jest.fn()} />);
    expect(screen.getByText(/grown 3×/i)).toBeInTheDocument();
  });

  it('truncates the genome hash but exposes the full value to assistive tech', () => {
    render(<SporeCard spore={spore()} onGerminate={jest.fn()} />);
    const btn = screen.getByRole('button', { name: /copy genome hash/i });
    expect(btn).toHaveTextContent('abcdef012345');
    expect(btn).toHaveAccessibleName(new RegExp('abcdef0123456789'.repeat(4)));
  });

  it('offers all three germination targets only after asking', async () => {
    render(<SporeCard spore={spore()} onGerminate={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /new ritual/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^germinate$/i }));
    expect(screen.getByRole('button', { name: /new ritual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mix draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /beehive/i })).toBeInTheDocument();
  });

  it('germinates with the chosen target and closes the sheet', async () => {
    const onGerminate = jest.fn().mockResolvedValue(undefined);
    render(<SporeCard spore={spore()} onGerminate={onGerminate} />);
    await userEvent.click(screen.getByRole('button', { name: /^germinate$/i }));
    await userEvent.click(screen.getByRole('button', { name: /new ritual/i }));
    expect(onGerminate).toHaveBeenCalledWith('sp1', 'mixhive_session');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /new ritual/i })).not.toBeInTheDocument()
    );
  });

  it('lets you back out without germinating', async () => {
    const onGerminate = jest.fn();
    render(<SporeCard spore={spore()} onGerminate={onGerminate} />);
    await userEvent.click(screen.getByRole('button', { name: /^germinate$/i }));
    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(onGerminate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^germinate$/i })).toBeInTheDocument();
  });

  it('disables the hash button when a spore has no genome', () => {
    render(<SporeCard spore={spore({ content_hash: null })} onGerminate={jest.fn()} />);
    expect(screen.getByRole('button', { name: /no genome hash yet/i })).toBeDisabled();
  });
});
