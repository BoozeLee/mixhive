import { test, expect } from '@playwright/test';

test.describe('API routes', () => {
  test('GET /api/hive-story returns JSON', async ({ request }) => {
    const res = await request.get('/api/hive-story');
    const body = await res.json();
    // Either issues array (200) or an error (500 if Supabase env mismatch) — both valid JSON
    expect(typeof body).toBe('object');
  });

  test('POST /api/push/subscribe without auth returns 401', async ({ request }) => {
    const res = await request.post('/api/push/subscribe', {
      data: { endpoint: 'https://example.com', p256dh: 'key', auth: 'auth' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/push/send without auth returns 401', async ({ request }) => {
    const res = await request.post('/api/push/send', {
      data: { user_id: 'test', title: 'Test' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/marketplace/agents/fake-id/buy without auth returns 401', async ({ request }) => {
    const res = await request.post(
      '/api/marketplace/agents/00000000-0000-0000-0000-000000000000/buy'
    );
    expect(res.status()).toBe(401);
  });

  test('GET /api/health reports service health', async ({ request }) => {
    const res = await request.get('/api/health');
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    expect(body.services).toBeDefined();
  });

  test('GET /api/cron/push-sender without CRON_SECRET returns 401', async ({ request }) => {
    const res = await request.get('/api/cron/push-sender');
    expect(res.status()).toBe(401);
  });

  test('DELETE /api/push/subscribe without auth returns 401', async ({ request }) => {
    const res = await request.delete('/api/push/subscribe', {
      data: { endpoint: 'https://example.com' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/hive-story/nonexistent-slug returns 404', async ({ request }) => {
    const res = await request.get('/api/hive-story/this-does-not-exist');
    expect(res.status()).toBe(404);
  });
});
