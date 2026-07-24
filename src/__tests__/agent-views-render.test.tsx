// Reproduction: Opportunities and SceneRadar render a blank/broken page for
// logged-in users. Mount each with an authenticated user and benign mocks; a
// synchronous render crash will fail these tests and surface the exact error.

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    profile: { id: 'u1', username: 'dj', display_name: 'DJ', genres: [], location: null },
    loading: false,
  }),
}));

jest.mock('../lib/agents', () => ({
  // Populated output so SceneRadar's notification/suggestion/task render paths
  // are actually exercised (empty arrays would skip them).
  runStrategicAgent: jest.fn().mockResolvedValue({
    status: 'ok',
    tokens_used: 12,
    duration_ms: 34,
    notifications: [
      { channel: 'scene', subject: 'Ghent techno rising', body: 'Details', cta_url: '/discover' },
    ],
    suggestions: [
      {
        type: 'collab_suggestion',
        payload: {},
        confidence: 0.8,
        rationale: 'With DJ Neo',
        requires_approval: false,
      },
    ],
    tasks: [{ title: 'Upload a mix', priority: 'high', due_date: '2026-08-01' }],
  }),
}));

jest.mock('../lib/api', () => ({
  getOpportunitySaves: jest.fn().mockResolvedValue({}),
  upsertOpportunitySave: jest.fn().mockResolvedValue(undefined),
}));

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ opportunities: [] }),
}) as unknown as typeof fetch;

import React from 'react';
import { render } from '@testing-library/react';
import { SceneRadar } from '../views/SceneRadar';
import { Opportunities } from '../views/Opportunities';

describe('agent-powered views render without crashing (logged in)', () => {
  // Regression for Opportunities: `tabLabels is not defined` (renamed to
  // TAB_KEYS) crashed the whole view to a blank page on mount.
  it('Opportunities mounts', () => {
    expect(() => render(<Opportunities />)).not.toThrow();
  });

  it('SceneRadar mounts', () => {
    expect(() => render(<SceneRadar />)).not.toThrow();
  });
});
