// Ed25519 detached signatures over the genome hash. Server-only.
//
// The signature travels inside the spore document, and the public key is served
// from /.well-known/mixhive-flow-key.json, so anyone holding a spore can verify
// integrity and origin with no database, no chain, and no network beyond that
// one static file.
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';

export interface SealKey {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
}

export function generateSealKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/** Detached Ed25519 signature over the ASCII genome hash, base64url, unpadded. */
export function signGenome(contentHash: string, privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem);
  return cryptoSign(null, Buffer.from(contentHash, 'utf8'), key).toString('base64url');
}

export function verifyGenome(
  contentHash: string,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    return cryptoVerify(
      null,
      Buffer.from(contentHash, 'utf8'),
      createPublicKey(publicKeyPem),
      Buffer.from(signature, 'base64url')
    );
  } catch {
    return false;
  }
}

export function loadSealKey(): SealKey {
  const privateKeyPem = process.env.FLOW_KEY_SEAL_KEY;
  if (!privateKeyPem) {
    throw new Error('FLOW_KEY_SEAL_KEY is not configured; cannot seal a spore');
  }
  const publicKeyPem = createPublicKey(createPrivateKey(privateKeyPem))
    .export({ type: 'spki', format: 'pem' })
    .toString();
  return {
    privateKeyPem,
    publicKeyPem,
    keyId: process.env.FLOW_KEY_SEAL_KEY_ID || 'fk-unversioned',
  };
}

/**
 * Public keys for offline verification, newest first. Rotation keeps the previous
 * public key published so spores sealed before a rotation stay verifiable forever.
 * Returns [] when unconfigured — the well-known endpoint must not 500.
 */
export function loadVerificationKeys(): Array<{ keyId: string; publicKeyPem: string }> {
  const keys: Array<{ keyId: string; publicKeyPem: string }> = [];
  try {
    const current = loadSealKey();
    keys.push({ keyId: current.keyId, publicKeyPem: current.publicKeyPem });
  } catch {
    return [];
  }
  const previous = process.env.FLOW_KEY_SEAL_KEY_PREVIOUS;
  if (previous) {
    keys.push({
      keyId: process.env.FLOW_KEY_SEAL_KEY_PREVIOUS_ID || 'fk-previous',
      publicKeyPem: previous,
    });
  }
  return keys;
}
