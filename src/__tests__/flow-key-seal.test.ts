import {
  generateSealKeyPair,
  signGenome,
  verifyGenome,
  loadSealKey,
  loadVerificationKeys,
} from '@/lib/flow-key/seal';

const HASH = 'a'.repeat(64);

describe('Ed25519 genome seal', () => {
  const { privateKeyPem, publicKeyPem } = generateSealKeyPair();

  it('round-trips a signature', () => {
    const sig = signGenome(HASH, privateKeyPem);
    expect(verifyGenome(HASH, sig, publicKeyPem)).toBe(true);
  });

  it('produces base64url with no padding', () => {
    expect(signGenome(HASH, privateKeyPem)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic (Ed25519 has no nonce)', () => {
    expect(signGenome(HASH, privateKeyPem)).toBe(signGenome(HASH, privateKeyPem));
  });

  it('fails when the genome is tampered with', () => {
    const sig = signGenome(HASH, privateKeyPem);
    expect(verifyGenome('b'.repeat(64), sig, publicKeyPem)).toBe(false);
  });

  it('fails against a different key', () => {
    const other = generateSealKeyPair();
    const sig = signGenome(HASH, privateKeyPem);
    expect(verifyGenome(HASH, sig, other.publicKeyPem)).toBe(false);
  });

  it('returns false rather than throwing on a malformed signature', () => {
    expect(verifyGenome(HASH, 'not-a-signature', publicKeyPem)).toBe(false);
  });
});

describe('loadSealKey', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('throws a clear error when unconfigured', () => {
    delete process.env.FLOW_KEY_SEAL_KEY;
    expect(() => loadSealKey()).toThrow(/FLOW_KEY_SEAL_KEY/);
  });

  it('derives the public key from the private key and reports the key id', () => {
    const { privateKeyPem } = generateSealKeyPair();
    process.env.FLOW_KEY_SEAL_KEY = privateKeyPem;
    process.env.FLOW_KEY_SEAL_KEY_ID = 'fk-test';
    const loaded = loadSealKey();
    expect(loaded.keyId).toBe('fk-test');
    expect(loaded.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(verifyGenome(HASH, signGenome(HASH, loaded.privateKeyPem), loaded.publicKeyPem)).toBe(
      true
    );
  });

  it('publishes the previous key too, so rotation does not invalidate old spores', () => {
    const current = generateSealKeyPair();
    const previous = generateSealKeyPair();
    process.env.FLOW_KEY_SEAL_KEY = current.privateKeyPem;
    process.env.FLOW_KEY_SEAL_KEY_ID = 'fk-new';
    process.env.FLOW_KEY_SEAL_KEY_PREVIOUS = previous.publicKeyPem;
    process.env.FLOW_KEY_SEAL_KEY_PREVIOUS_ID = 'fk-old';
    const keys = loadVerificationKeys();
    expect(keys.map(k => k.keyId)).toEqual(['fk-new', 'fk-old']);
  });

  it('returns an empty key list rather than throwing when unconfigured', () => {
    delete process.env.FLOW_KEY_SEAL_KEY;
    expect(loadVerificationKeys()).toEqual([]);
  });
});
