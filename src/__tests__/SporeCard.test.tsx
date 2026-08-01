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
  countersigned_count: 0,
  can_countersign: false,
  i_countersigned: false,
  anchor: null,
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

  it('says plainly when nobody has vouched for it yet', () => {
    render(<SporeCard spore={spore()} onGerminate={jest.fn()} />);
    expect(screen.getByText(/nobody has signed for this yet/i)).toBeInTheDocument();
  });

  it('reports how many of the humans have signed', () => {
    render(
      <SporeCard
        spore={spore({ carbon_count: 3, countersigned_count: 2 })}
        onGerminate={jest.fn()}
      />
    );
    expect(screen.getByText(/2 of 3 signed for it/i)).toBeInTheDocument();
  });

  it('notes when the viewer is among the signers', () => {
    render(
      <SporeCard
        spore={spore({ countersigned_count: 1, i_countersigned: true })}
        onGerminate={jest.fn()}
      />
    );
    expect(screen.getByText(/including you/i)).toBeInTheDocument();
  });

  it('shows the notary state — unanchored by default', () => {
    render(<SporeCard spore={spore()} onGerminate={jest.fn()} />);
    expect(screen.getByText(/sealed, not yet notarised/i)).toBeInTheDocument();
  });

  it('shows the batch date once notarised, and the root on hover', () => {
    render(
      <SporeCard
        spore={spore({
          anchor: {
            batch_date: '2026-07-30',
            merkle_root: 'f'.repeat(64),
            chain: null,
            anchored_at: null,
          },
        })}
        onGerminate={jest.fn()}
      />
    );
    const el = screen.getByText(/notarised 2026-07-30/i);
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('title', expect.stringContaining('f'.repeat(64)));
  });

  it('names the chain when a root was additionally anchored on one', () => {
    render(
      <SporeCard
        spore={spore({
          anchor: {
            batch_date: '2026-07-30',
            merkle_root: 'a'.repeat(64),
            chain: 'base-sepolia',
            anchored_at: '2026-07-31T00:00:00.000Z',
          },
        })}
        onGerminate={jest.fn()}
      />
    );
    expect(screen.getByText(/base-sepolia/i)).toBeInTheDocument();
  });

  it('offers signing only to an unsigned contributor who has a wallet', () => {
    const onCountersign = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <SporeCard spore={spore({ can_countersign: true })} onGerminate={jest.fn()} />
    );
    // No wallet handler supplied -> no offer.
    expect(screen.queryByRole('button', { name: /sign that you were there/i })).not.toBeInTheDocument();

    rerender(
      <SporeCard
        spore={spore({ can_countersign: true })}
        onGerminate={jest.fn()}
        onCountersign={onCountersign}
      />
    );
    expect(screen.getByRole('button', { name: /sign that you were there/i })).toBeInTheDocument();
  });

  it('does not offer signing to someone who already signed', () => {
    render(
      <SporeCard
        spore={spore({ can_countersign: false, i_countersigned: true })}
        onGerminate={jest.fn()}
        onCountersign={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /sign that you were there/i })).not.toBeInTheDocument();
  });

  it('calls onCountersign with the spore id', async () => {
    const onCountersign = jest.fn().mockResolvedValue(undefined);
    render(
      <SporeCard
        spore={spore({ can_countersign: true })}
        onGerminate={jest.fn()}
        onCountersign={onCountersign}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /sign that you were there/i }));
    expect(onCountersign).toHaveBeenCalledWith('sp1');
  });
});
