import { buildMerkleBatch, verifyInclusion, leafHash } from '@/lib/flow-key/merkle';
import { createHash } from 'node:crypto';

const h = (s: string) => createHash('sha256').update(s).digest('hex');

describe('buildMerkleBatch', () => {
  it('refuses an empty batch rather than inventing a root', () => {
    expect(() => buildMerkleBatch([])).toThrow(/empty batch/i);
  });

  it('handles a single leaf — root is the leaf, proof is empty', () => {
    const b = buildMerkleBatch([h('a')]);
    expect(b.leafCount).toBe(1);
    expect(b.proofs[0]).toEqual([]);
    expect(b.root).toBe(leafHash(h('a')).toString('hex'));
  });

  it('is deterministic for the same input', () => {
    const one = buildMerkleBatch([h('a'), h('b'), h('c')]);
    const two = buildMerkleBatch([h('a'), h('b'), h('c')]);
    expect(one.root).toBe(two.root);
  });

  it('changes root when any leaf changes', () => {
    const base = buildMerkleBatch([h('a'), h('b')]).root;
    expect(buildMerkleBatch([h('a'), h('B')]).root).not.toBe(base);
  });

  it('changes root when leaf order changes (order is significant)', () => {
    expect(buildMerkleBatch([h('a'), h('b')]).root).not.toBe(
      buildMerkleBatch([h('b'), h('a')]).root
    );
  });

  it('produces one proof per leaf', () => {
    const b = buildMerkleBatch([h('a'), h('b'), h('c'), h('d'), h('e')]);
    expect(b.proofs).toHaveLength(5);
    expect(b.leafCount).toBe(5);
  });
});

describe('verifyInclusion', () => {
  it.each([1, 2, 3, 4, 5, 8, 9, 17])('verifies every leaf in a batch of %i', n => {
    const hashes = Array.from({ length: n }, (_, i) => h(`spore-${i}`));
    const batch = buildMerkleBatch(hashes);
    hashes.forEach((hash, i) => {
      expect(verifyInclusion(hash, batch.proofs[i] as never, batch.root)).toBe(true);
    });
  });

  it('rejects a hash that was never in the batch', () => {
    const hashes = [h('a'), h('b'), h('c')];
    const batch = buildMerkleBatch(hashes);
    expect(verifyInclusion(h('not-in-batch'), batch.proofs[0] as never, batch.root)).toBe(false);
  });

  it('rejects a proof from a different leaf', () => {
    const hashes = [h('a'), h('b'), h('c'), h('d')];
    const batch = buildMerkleBatch(hashes);
    expect(verifyInclusion(hashes[0] as string, batch.proofs[2] as never, batch.root)).toBe(false);
  });

  it('rejects a tampered proof step', () => {
    const hashes = [h('a'), h('b'), h('c'), h('d')];
    const batch = buildMerkleBatch(hashes);
    const tampered = (batch.proofs[0] as never as Array<{ hash: string; position: string }>).map(
      s => ({ ...s, hash: h('evil') })
    );
    expect(verifyInclusion(hashes[0] as string, tampered as never, batch.root)).toBe(false);
  });

  it('rejects a flipped sibling position', () => {
    const hashes = [h('a'), h('b'), h('c'), h('d')];
    const batch = buildMerkleBatch(hashes);
    const flipped = (batch.proofs[0] as never as Array<{ hash: string; position: string }>).map(
      s => ({ ...s, position: s.position === 'left' ? 'right' : 'left' })
    );
    expect(verifyInclusion(hashes[0] as string, flipped as never, batch.root)).toBe(false);
  });

  it('rejects against a different root', () => {
    const batch = buildMerkleBatch([h('a'), h('b')]);
    const other = buildMerkleBatch([h('x'), h('y')]);
    expect(verifyInclusion(h('a'), batch.proofs[0] as never, other.root)).toBe(false);
  });

  it('returns false rather than throwing on malformed input', () => {
    expect(verifyInclusion('not-hex', [], 'also-not-hex')).toBe(false);
  });

  it('domain-separates leaves from internal nodes (second-preimage guard)', () => {
    // An internal node's hash must never verify as if it were a leaf.
    const hashes = [h('a'), h('b')];
    const batch = buildMerkleBatch(hashes);
    expect(verifyInclusion(batch.root, [], batch.root)).toBe(false);
  });
});
