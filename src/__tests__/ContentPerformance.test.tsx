jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('../components/hive', () => ({
  HiveCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentPerformance } from '../components/ContentPerformance';
import type { Mix } from '../lib/types';

function mix(partial: Partial<Mix>): Mix {
  return partial as Mix;
}

// A: 100 plays, engagement 20%. B: 200 plays, engagement 5%. C: 0 plays → "—".
const MIXES = [
  mix({ id: 'a', title: 'Midnight Drive', play_count: 100, like_count: 10, comment_count: 10 }),
  mix({ id: 'b', title: 'Warehouse Set', play_count: 200, like_count: 5, comment_count: 5 }),
  mix({ id: 'c', title: 'New Demo', play_count: 0, like_count: 3, comment_count: 1 }),
];
const GENRES = [
  { name: 'Techno', count: 3 },
  { name: 'House', count: 1 },
];

function mixOrder(): string[] {
  // Each mix row's link carries the title as its accessible name.
  return screen.getAllByRole('link').map(a => a.textContent?.trim() ?? '');
}

describe('ContentPerformance', () => {
  it('renders a row per mix with engagement % (— when no plays)', () => {
    render(<ContentPerformance mixes={MIXES} genres={GENRES} />);
    expect(screen.getByText('Content performance')).toBeInTheDocument();
    expect(screen.getByText('Midnight Drive')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument(); // A: 20/100
    expect(screen.getByText('5%')).toBeInTheDocument(); // B: 10/200
    expect(screen.getByText('—')).toBeInTheDocument(); // C: 0 plays
  });

  it('defaults to Plays descending', () => {
    render(<ContentPerformance mixes={MIXES} genres={GENRES} />);
    expect(mixOrder()).toEqual(['Warehouse Set', 'Midnight Drive', 'New Demo']);
  });

  it('re-sorts by Likes descending when the Likes header is clicked', async () => {
    render(<ContentPerformance mixes={MIXES} genres={GENRES} />);
    await userEvent.click(screen.getByRole('button', { name: /likes/i }));
    expect(mixOrder()).toEqual(['Midnight Drive', 'Warehouse Set', 'New Demo']);
  });

  it('toggles to ascending on a second click of the active column', async () => {
    render(<ContentPerformance mixes={MIXES} genres={GENRES} />);
    await userEvent.click(screen.getByRole('button', { name: /plays/i })); // desc -> asc
    expect(mixOrder()).toEqual(['New Demo', 'Midnight Drive', 'Warehouse Set']);
  });

  it('shows genre distribution shares', () => {
    render(<ContentPerformance mixes={MIXES} genres={GENRES} />);
    expect(screen.getByText('Techno')).toBeInTheDocument();
    expect(screen.getByText('3 · 75%')).toBeInTheDocument(); // 3 of 4
    expect(screen.getByText('1 · 25%')).toBeInTheDocument();
  });

  it('shows an empty state when there are no mixes', () => {
    render(<ContentPerformance mixes={[]} genres={[]} />);
    expect(screen.getByText(/Publish a mix to see how each one performs/i)).toBeInTheDocument();
  });
});
