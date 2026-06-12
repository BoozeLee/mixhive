import { createHmac } from 'node:crypto';

export const TURN_CREDENTIAL_TTL_SECONDS = 6 * 60 * 60;

export interface TurnCredentialConfig {
  enabled: boolean;
  sharedSecret: string;
  urls: string[];
  ttlSeconds: number;
}

export interface TurnCredentials {
  iceServers: Array<{
    urls: string[];
    username: string;
    credential: string;
  }>;
  expiresAt: string;
}

export function readTurnCredentialConfig(): TurnCredentialConfig {
  const sharedSecret = process.env.TURN_SHARED_SECRET?.trim() ?? '';
  const urls = (process.env.TURN_URLS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(value => /^turns?:/i.test(value));
  const ttl = Number(process.env.TURN_CREDENTIAL_TTL_SECONDS ?? TURN_CREDENTIAL_TTL_SECONDS);

  return {
    enabled: process.env.TURN_CREDENTIALS_ENABLED === 'true',
    sharedSecret,
    urls,
    ttlSeconds:
      Number.isFinite(ttl) && ttl >= 300
        ? Math.min(Math.floor(ttl), TURN_CREDENTIAL_TTL_SECONDS)
        : TURN_CREDENTIAL_TTL_SECONDS,
  };
}

export function createTurnCredentials(
  profileId: string,
  config: TurnCredentialConfig,
  now = Date.now()
): TurnCredentials {
  if (!config.enabled || config.sharedSecret.length < 32 || config.urls.length === 0) {
    throw new Error('TURN credentials are not configured');
  }

  const expiresAtSeconds = Math.floor(now / 1000) + config.ttlSeconds;
  const username = `${expiresAtSeconds}:${profileId}`;
  const credential = createHmac('sha1', config.sharedSecret).update(username).digest('base64');

  return {
    iceServers: [{ urls: config.urls, username, credential }],
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}
