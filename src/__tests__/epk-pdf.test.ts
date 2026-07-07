/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/epk/[slug]/pdf/route';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

jest.mock('@react-pdf/renderer', () => ({
  Document: jest.fn(),
  Page: jest.fn(),
  Text: jest.fn(),
  View: jest.fn(),
  Link: jest.fn(),
  Image: jest.fn(),
  StyleSheet: { create: jest.fn(() => ({})) },
  renderToStream: jest.fn().mockResolvedValue(Buffer.from('PDF')),
}));

describe('epk pdf export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({
            data: {
              title: 'DJ Test EPK',
              is_public: true,
              content: {
                artist_name: 'DJ Test',
                genres: ['house'],
                top_mixes: [],
                booking_pitch: 'Book me.',
                technical_notes: [],
              },
            },
            error: null,
          }),
        }),
      }),
    }));
  });

  it('returns a PDF for a public press kit', async () => {
    const req = new NextRequest('https://mixhive.test/api/epk/dj-test-epk/pdf');
    const res = await GET(req, { params: Promise.resolve({ slug: 'dj-test-epk' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
  });

  it('returns 404 for a non-public press kit', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({
            data: { is_public: false, content: {} },
            error: null,
          }),
        }),
      }),
    }));
    const req = new NextRequest('https://mixhive.test/api/epk/private-epk/pdf');
    const res = await GET(req, { params: Promise.resolve({ slug: 'private-epk' }) });
    expect(res.status).toBe(404);
  });
});
