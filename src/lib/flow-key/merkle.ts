// Layer C — the notary.
//
// Anchoring each spore on chain individually costs gas proportional to culture,
// which is backwards. Instead a daily batch builds one Merkle tree over every
// genome sealed that day and publishes a single root. Each spore then carries an
// inclusion proof: evidence it existed before that root was published, verifiable
// by anyone, at a cost of one transaction per day regardless of volume.
//
// Domain separation: leaves are hashed with a 0x00 prefix and internal nodes
// with 0x01. Without this, an attacker could present an internal node as if it
// were a leaf (the classic second-preimage attack on Merkle trees).
import { createHash } from 'node:crypto';

const LEAF_PREFIX = Buffer.from([0x00]);
const NODE_PREFIX = Buffer.from([0x01]);

function sha256(...parts: Buffer[]): Buffer {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest();
}

/** Hash a genome hex digest into a domain-separated leaf. */
export function leafHash(contentHash: string): Buffer {
  return sha256(LEAF_PREFIX, Buffer.from(contentHash, 'hex'));
}

function nodeHash(left: Buffer, right: Buffer): Buffer {
  return sha256(NODE_PREFIX, left, right);
}

export interface ProofStep {
  hash: string;
  position: 'left' | 'right';
}

export interface MerkleBatch {
  root: string;
  leafCount: number;
  /** Inclusion proof per input content hash, in input order. */
  proofs: ProofStep[][];
}

/**
 * Build a Merkle tree over content hashes. Order is the caller's; callers should
 * sort for determinism. An odd node at any level is promoted rather than
 * duplicated — duplicating a node lets two different leaf sets produce the same
 * root, which would let a spore be "proven" into a batch it was never in.
 */
export function buildMerkleBatch(contentHashes: string[]): MerkleBatch {
  if (contentHashes.length === 0) {
    throw new Error('Cannot anchor an empty batch');
  }

  const leaves = contentHashes.map(leafHash);
  const proofs: ProofStep[][] = contentHashes.map(() => []);
  // Which indices of the current level each original leaf now sits under.
  let indexOfLeaf = contentHashes.map((_, i) => i);
  let level = leaves;

  while (level.length > 1) {
    const next: Buffer[] = [];
    const nextIndex = new Array<number>(indexOfLeaf.length);

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i] as Buffer;
      const right = level[i + 1];

      if (right === undefined) {
        // Odd one out: promote unchanged, and record no proof step for it.
        next.push(left);
        for (let l = 0; l < indexOfLeaf.length; l++) {
          if (indexOfLeaf[l] === i) nextIndex[l] = next.length - 1;
        }
        continue;
      }

      next.push(nodeHash(left, right));
      const parent = next.length - 1;
      for (let l = 0; l < indexOfLeaf.length; l++) {
        if (indexOfLeaf[l] === i) {
          (proofs[l] as ProofStep[]).push({ hash: right.toString('hex'), position: 'right' });
          nextIndex[l] = parent;
        } else if (indexOfLeaf[l] === i + 1) {
          (proofs[l] as ProofStep[]).push({ hash: left.toString('hex'), position: 'left' });
          nextIndex[l] = parent;
        }
      }
    }

    level = next;
    indexOfLeaf = nextIndex;
  }

  return {
    root: (level[0] as Buffer).toString('hex'),
    leafCount: contentHashes.length,
    proofs,
  };
}

/**
 * Verify a spore's inclusion in a published root. Needs only the genome hash,
 * the proof, and the root — no database, no chain, no MixHive.
 */
export function verifyInclusion(contentHash: string, proof: ProofStep[], root: string): boolean {
  try {
    let current = leafHash(contentHash);
    for (const step of proof) {
      const sibling = Buffer.from(step.hash, 'hex');
      current = step.position === 'right' ? nodeHash(current, sibling) : nodeHash(sibling, current);
    }
    return current.toString('hex') === root;
  } catch {
    return false;
  }
}
