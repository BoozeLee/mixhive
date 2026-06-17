import { render, screen, waitFor } from '@testing-library/react';
import { AiBandBadge } from '@/components/AiBandBadge';
import { AgentBandCredits } from '@/components/AgentBandCredits';
import { getMixAgentCredits } from '@/lib/api';

// Mock react-router-dom's Link to a plain anchor (repo pattern — avoids pulling
// the full router, which needs TextEncoder in jsdom).
jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
jest.mock('@/lib/api', () => ({ getMixAgentCredits: jest.fn() }));
const mockGetCredits = getMixAgentCredits as jest.Mock;

describe('AiBandBadge', () => {
  it('renders the AI Band label', () => {
    render(<AiBandBadge />);
    expect(screen.getByText(/AI Band/i)).toBeInTheDocument();
  });
});

describe('AgentBandCredits', () => {
  it('renders a band-member card per credit, linking to the agent page', async () => {
    mockGetCredits.mockResolvedValue([
      {
        id: 'c1',
        mix_id: 'm1',
        agent_slug: 'acid-oracle',
        agent_name: 'Acid Oracle',
        agent_role: 'Beatsmith',
        contribution: 'Generated the acid line',
        model: 'fable-5',
        ord: 0,
      },
    ]);
    render(<AgentBandCredits mixId="m1" />);
    await waitFor(() => expect(screen.getByText('Acid Oracle')).toBeInTheDocument());
    expect(screen.getByText('Beatsmith')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ai-band/agent/acid-oracle');
  });

  it('renders nothing when there are no credits', async () => {
    mockGetCredits.mockResolvedValue([]);
    const { container } = render(<AgentBandCredits mixId="m2" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
