import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowKeyTap } from '@/components/FlowKeyTap';

const ritualRequest = jest.fn();
jest.mock('@/lib/rituals', () => ({
  ritualRequest: (...args: unknown[]) => ritualRequest(...args),
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

describe('FlowKeyTap', () => {
  it('loads tap state and renders the capped count', async () => {
    ritualRequest.mockResolvedValue({
      is_open: false,
      opened_at: null,
      turns_count: 0,
      spore_id: null,
      capped: 2,
      skipped: 1,
      live_take: null,
    });
    render(<FlowKeyTap sessionId="s1" isCreator />);
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAccessibleName(/2 of 3 cells capped/i)
    );
  });

  it('turns the key, then seals, without unmounting the room', async () => {
    ritualRequest
      .mockResolvedValueOnce({
        is_open: false,
        opened_at: null,
        turns_count: 0,
        spore_id: null,
        capped: 2,
        skipped: 0,
        live_take: null,
      })
      .mockResolvedValueOnce({ spore_id: 'sp1', capped: 2, skipped: 0, turns_count: 1 })
      .mockResolvedValueOnce({ spore_id: 'sp1', content_hash: 'a'.repeat(64), capped: 2 })
      .mockResolvedValue({
        is_open: false,
        opened_at: null,
        turns_count: 1,
        spore_id: null,
        capped: 2,
        skipped: 0,
        live_take: null,
      });

    render(<FlowKeyTap sessionId="s1" isCreator />);
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(ritualRequest).toHaveBeenCalledWith(
        '/api/mythic/sessions/s1/flow-key',
        expect.objectContaining({ method: 'POST' })
      )
    );
    await waitFor(() =>
      expect(ritualRequest).toHaveBeenCalledWith(
        '/api/mythic/sessions/s1/flow-key/seal',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('surfaces nothing_capped as an ambient state, not a thrown error', async () => {
    ritualRequest.mockResolvedValue({
      is_open: false,
      opened_at: null,
      turns_count: 0,
      spore_id: null,
      capped: 0,
      skipped: 2,
      live_take: null,
    });
    render(<FlowKeyTap sessionId="s1" isCreator />);
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(screen.getByRole('button')).toHaveAccessibleName(/nothing's capped yet/i);
  });

  it('renders a status glyph, not a button, for the audience', async () => {
    ritualRequest.mockResolvedValue({
      is_open: true,
      opened_at: '2026-07-30T22:00:00.000Z',
      turns_count: 1,
      spore_id: 'sp1',
      capped: 2,
      skipped: 0,
      live_take: null,
    });
    render(<FlowKeyTap sessionId="s1" isCreator={false} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/comb draining/i));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
