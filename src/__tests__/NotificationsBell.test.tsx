jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/notificationStore', () => ({
  useNotifications: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { NotificationsBell } from '../components/NotificationsBell';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../lib/notificationStore';

const mockUseAuth = useAuth as jest.Mock;
const mockUseNotifications = useNotifications as jest.Mock;

describe('NotificationsBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    mockUseNotifications.mockReturnValue({ unreadCount: 0 });
  });

  it('renders nothing when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { container } = render(<NotificationsBell />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a link to /notifications when authenticated', () => {
    render(<NotificationsBell />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/notifications');
  });

  it('shows no badge when unreadCount is 0', () => {
    render(<NotificationsBell />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('shows numeric badge for unread count between 1 and 9', () => {
    mockUseNotifications.mockReturnValue({ unreadCount: 3 });
    render(<NotificationsBell />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows "9+" badge when unreadCount exceeds 9', () => {
    mockUseNotifications.mockReturnValue({ unreadCount: 12 });
    render(<NotificationsBell />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });
});
