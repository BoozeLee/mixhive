import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AgentFollowButton } from '@/components/AgentFollowButton';
import * as api from '@/lib/api';

jest.mock('../hooks/useAuth', () => {
  const user = { id: 'viewer-1' };
  return { useAuth: () => ({ user }) };
});
jest.mock('@/lib/api', () => ({
  isFollowingAgent: jest.fn().mockResolvedValue(false),
  followAgent: jest.fn().mockResolvedValue({ error: null }),
  unfollowAgent: jest.fn().mockResolvedValue({ error: null }),
}));
// Repo pattern: t(key) returns the key ('follow' / 'following').
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('AgentFollowButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('follows an agent on click and reports the delta', async () => {
    const onChange = jest.fn();
    render(<AgentFollowButton slug="acid-oracle" onChange={onChange} />);
    const btn = await screen.findByRole('button', { name: /follow/i });
    expect(btn).toHaveTextContent('follow');

    fireEvent.click(btn);

    await waitFor(() =>
      expect(mockApi.followAgent).toHaveBeenCalledWith('acid-oracle', 'viewer-1')
    );
    expect(onChange).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('following'));
  });
});
