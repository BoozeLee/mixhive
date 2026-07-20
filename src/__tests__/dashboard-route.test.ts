/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('dashboard routing', () => {
  it('does not redirect /dashboard to /feed in vercel.json', () => {
    const vercelJson = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8'));
    const dashboardRedirect = vercelJson.redirects?.find(
      (r: { source: string }) => r.source === '/dashboard'
    );
    expect(dashboardRedirect).toBeUndefined();
  });

  it('does not redirect /dashboard to /feed in next.config.mjs', () => {
    const config = readFileSync(resolve(process.cwd(), 'next.config.mjs'), 'utf-8');
    expect(config).not.toMatch(/source:\s*['"]\/dashboard['"]/);
    expect(config).not.toMatch(/destination:\s*['"]\/feed['"]/);
  });
});
