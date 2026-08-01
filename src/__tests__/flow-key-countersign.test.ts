/** @jest-environment node */
// ethers' Wallet.createRandom() needs real entropy, which jsdom does not supply.

import { Wallet } from 'ethers';
import { countersignMessage, verifyCountersignature } from '@/lib/flow-key/countersign';

const wallet = Wallet.createRandom();
const other = Wallet.createRandom();

const subject = {
  sporeId: 'sp1',
  contentHash: 'a'.repeat(64),
  sessionId: 'se1',
  address: wallet.address,
};

describe('countersignMessage', () => {
  it('states plainly what is being attested', () => {
    const msg = countersignMessage(subject);
    expect(msg).toContain('I was in this room, and I say so.');
    expect(msg).toContain('MixHive Flow Key');
  });

  it('commits to the genome hash, spore and session', () => {
    const msg = countersignMessage(subject);
    expect(msg).toContain(`Genome: ${'a'.repeat(64)}`);
    expect(msg).toContain('Spore: sp1');
    expect(msg).toContain('Session: se1');
  });

  it('normalises the address to lowercase so casing cannot fork the message', () => {
    expect(countersignMessage({ ...subject, address: wallet.address.toUpperCase() })).toBe(
      countersignMessage({ ...subject, address: wallet.address.toLowerCase() })
    );
  });

  it('is deterministic', () => {
    expect(countersignMessage(subject)).toBe(countersignMessage({ ...subject }));
  });
});

describe('verifyCountersignature', () => {
  it('accepts a signature from the named address', async () => {
    const sig = await wallet.signMessage(countersignMessage(subject));
    expect(verifyCountersignature(subject, sig)).toBe(true);
  });

  it('accepts regardless of the address casing supplied', async () => {
    const sig = await wallet.signMessage(countersignMessage(subject));
    expect(verifyCountersignature({ ...subject, address: wallet.address.toUpperCase() }, sig)).toBe(
      true
    );
  });

  it('rejects a signature from a different wallet', async () => {
    const sig = await other.signMessage(countersignMessage(subject));
    expect(verifyCountersignature(subject, sig)).toBe(false);
  });

  it('rejects when the genome changed — no replay onto a mutated spore', async () => {
    const sig = await wallet.signMessage(countersignMessage(subject));
    expect(verifyCountersignature({ ...subject, contentHash: 'b'.repeat(64) }, sig)).toBe(false);
  });

  it('rejects when replayed onto a different spore', async () => {
    const sig = await wallet.signMessage(countersignMessage(subject));
    expect(verifyCountersignature({ ...subject, sporeId: 'sp2' }, sig)).toBe(false);
  });

  it('returns false rather than throwing on a malformed signature', () => {
    expect(verifyCountersignature(subject, 'not-a-signature')).toBe(false);
    expect(verifyCountersignature(subject, '')).toBe(false);
  });
});
