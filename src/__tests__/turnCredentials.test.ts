/**
 * @jest-environment node
 */

import { createHmac } from 'node:crypto';
import {
  createTurnCredentials,
  readTurnCredentialConfig,
  TURN_CREDENTIAL_TTL_SECONDS,
} from '../lib/turnCredentials';

describe('TURN REST credentials', () => {
  afterEach(() => {
    delete process.env.TURN_CREDENTIALS_ENABLED;
    delete process.env.TURN_SHARED_SECRET;
    delete process.env.TURN_URLS;
    delete process.env.TURN_CREDENTIAL_TTL_SECONDS;
  });

  it('creates a six-hour HMAC-SHA1 credential accepted by Coturn REST auth', () => {
    const now = Date.parse('2026-06-12T12:00:00.000Z');
    const result = createTurnCredentials(
      '00000000-0000-4000-8000-000000000001',
      {
        enabled: true,
        sharedSecret: 'server-only-secret-at-least-32-bytes',
        urls: ['turn:turn.mixhive.app:3478?transport=udp'],
        ttlSeconds: TURN_CREDENTIAL_TTL_SECONDS,
      },
      now
    );
    const username = result.iceServers[0]?.username ?? '';
    const expected = createHmac('sha1', 'server-only-secret-at-least-32-bytes')
      .update(username)
      .digest('base64');

    expect(username).toBe('1781287200:00000000-0000-4000-8000-000000000001');
    expect(result.iceServers[0]?.credential).toBe(expected);
    expect(result.expiresAt).toBe('2026-06-12T18:00:00.000Z');
  });

  it('refuses disabled or incomplete configuration', () => {
    expect(() =>
      createTurnCredentials('profile', {
        enabled: false,
        sharedSecret: 'server-only-secret-at-least-32-bytes',
        urls: ['turn:turn.mixhive.app:3478'],
        ttlSeconds: 3600,
      })
    ).toThrow('TURN credentials are not configured');
  });

  it('parses comma-separated server-only URLs and clamps unsafe TTLs', () => {
    process.env.TURN_CREDENTIALS_ENABLED = 'true';
    process.env.TURN_SHARED_SECRET = 'server-only-secret-at-least-32-bytes';
    process.env.TURN_URLS =
      'turn:turn.mixhive.app:3478?transport=udp, turns:turn.mixhive.app:5349?transport=tcp';
    process.env.TURN_CREDENTIAL_TTL_SECONDS = '60';

    expect(readTurnCredentialConfig()).toEqual({
      enabled: true,
      sharedSecret: 'server-only-secret-at-least-32-bytes',
      urls: [
        'turn:turn.mixhive.app:3478?transport=udp',
        'turns:turn.mixhive.app:5349?transport=tcp',
      ],
      ttlSeconds: TURN_CREDENTIAL_TTL_SECONDS,
    });
  });
});
