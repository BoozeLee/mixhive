// Allowlisted outbound HTTP tools for Lua agents.
// Agents cannot make arbitrary HTTP requests — only to pre-approved domains.

const ALLOWLIST = [
  'https://vi.be/',
  'https://www.vi.be/',
  'https://ra.co/',
  'https://api.bandsintown.com/',
  'https://api.audd.io/',
  'https://api.acrcloud.com/',
  'https://www.musicboard-berlin.de/',
];

function isAllowed(url: string): boolean {
  return ALLOWLIST.some(prefix => url.startsWith(prefix));
}

export const httpTools = {
  'http.get': async (url: string, headers?: Record<string, string>) => {
    if (!isAllowed(url)) throw new Error(`http.get blocked — not in allowlist: ${url}`);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`http.get ${url}: HTTP ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    return ct.includes('json') ? res.json() : res.text();
  },

  'http.post': async (
    url: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>
  ) => {
    if (!isAllowed(url)) throw new Error(`http.post blocked — not in allowlist: ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`http.post ${url}: HTTP ${res.status}`);
    return res.json();
  },
};
