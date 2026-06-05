// Tests for http tools — allowlist enforcement (security critical).

import { httpTools } from '@/server/lua-agents/tools/http';

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

const ALLOWED_URLS = [
  'https://vi.be/api/events',
  'https://www.vi.be/test',
  'https://ra.co/api/artists',
  'https://api.bandsintown.com/events',
  'https://api.audd.io/recognize',
  'https://api.acrcloud.com/v1/identify',
  'https://www.musicboard-berlin.de/events',
];

const BLOCKED_URLS = [
  'https://evil.com/steal-keys',
  'http://vi.be/insecure', // http not https
  'https://notvi.be/api', // similar domain, not allowlisted
  'https://vi.be.evil.com/', // subdomain trick
  'https://localhost/internal',
  'file:///etc/passwd',
  '',
];

describe('http.get allowlist', () => {
  it.each(ALLOWED_URLS)('allows %s', async url => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
    });
    await expect(httpTools['http.get'](url)).resolves.toBeDefined();
  });

  it.each(BLOCKED_URLS)('blocks %s', async url => {
    await expect(httpTools['http.get'](url)).rejects.toThrow('not in allowlist');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns JSON when content-type is json', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json; charset=utf-8' },
      json: async () => ({ data: 42 }),
    });
    const result = await httpTools['http.get']('https://vi.be/api/test');
    expect(result).toEqual({ data: 42 });
  });

  it('returns text when content-type is not json', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/html' },
      text: async () => '<html/>',
    });
    const result = await httpTools['http.get']('https://vi.be/page');
    expect(result).toBe('<html/>');
  });

  it('throws on non-ok HTTP status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
    });
    await expect(httpTools['http.get']('https://vi.be/api/missing')).rejects.toThrow('HTTP 404');
  });
});

describe('http.post allowlist', () => {
  it('blocks non-allowlisted domains', async () => {
    await expect(httpTools['http.post']('https://evil.com/hook', { data: 'x' })).rejects.toThrow(
      'not in allowlist'
    );
  });

  it('sends JSON body to allowed url', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ posted: true }),
    });
    const result = await httpTools['http.post']('https://vi.be/api/hook', { key: 'value' });
    expect(result).toEqual({ posted: true });
    expect((global.fetch as jest.Mock).mock.calls[0][1].method).toBe('POST');
  });
});
