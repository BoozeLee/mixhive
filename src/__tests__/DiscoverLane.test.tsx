jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DiscoverLane } from '../components/discover/DiscoverLane';

describe('DiscoverLane', () => {
  it('shows the empty label and hides scroll arrows when a resolved lane has no items', () => {
    render(
      <DiscoverLane title="Trending Mixes" emptyLabel="Nothing here yet — check back soon.">
        {[]}
      </DiscoverLane>
    );

    expect(screen.getByText('Nothing here yet — check back soon.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll right')).not.toBeInTheDocument();
  });

  it('renders items and scroll arrows when the lane has content', () => {
    render(
      <DiscoverLane title="Trending Mixes" emptyLabel="Nothing here yet.">
        <div>Mix One</div>
      </DiscoverLane>
    );

    expect(screen.getByText('Mix One')).toBeInTheDocument();
    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Scroll left')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll right')).toBeInTheDocument();
  });

  it('shows skeletons (not the empty state) while loading', () => {
    render(
      <DiscoverLane title="Trending Mixes" loading emptyLabel="Nothing here yet.">
        {[]}
      </DiscoverLane>
    );

    expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll left')).not.toBeInTheDocument();
  });
});
