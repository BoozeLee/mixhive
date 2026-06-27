/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('dashboard routing', () => {
  it('does not redirect /dashboard to /feed', () => {
    const vercelJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf-8')
    );
    const dashboardRedirect = vercelJson.redirects?.find(
      (r: any) => r.source === '/dashboard'
    );
    expect(dashboardRedirect).toBeUndefined();
  });
});
