// Layer B — contributor countersignatures.
//
// The server's Ed25519 seal (Layer A) says "MixHive attests this spore was
// drained from that ritual". A countersignature says something MixHive cannot
// say on anyone's behalf: "I was in that room, and I say so, signed with a key
// only I hold."
//
// It is non-transferable by construction — a signature names its signer and
// cannot be sold — which is exactly the property NFTs were reached for and
// failed to provide.
//
// Uses `verifyMessage` from ethers, the identical primitive already proven in
// src/app/api/wallet/connect/route.ts for SIWE linkage. No new dependency.
import { verifyMessage } from 'ethers';

export interface CountersignSubject {
  sporeId: string;
  contentHash: string;
  sessionId: string;
  address: string;
}

/**
 * The exact text a contributor signs. Deterministic and human-readable: a
 * wallet shows this verbatim, so it must state plainly what is being attested.
 * It commits to `contentHash`, so a signature cannot be replayed onto a
 * different spore or survive the genome changing.
 */
export function countersignMessage(subject: CountersignSubject): string {
  return [
    'MixHive Flow Key — countersign',
    '',
    'I was in this room, and I say so.',
    '',
    `Spore: ${subject.sporeId}`,
    `Genome: ${subject.contentHash}`,
    `Session: ${subject.sessionId}`,
    `Address: ${subject.address.toLowerCase()}`,
  ].join('\n');
}

/**
 * True when `signature` is a valid personal_sign over the countersign message
 * for `subject.address`. Returns false rather than throwing on malformed input —
 * a bad signature is an expected outcome, not an exception.
 */
export function verifyCountersignature(subject: CountersignSubject, signature: string): boolean {
  try {
    const recovered = verifyMessage(countersignMessage(subject), signature);
    return recovered.toLowerCase() === subject.address.toLowerCase();
  } catch {
    return false;
  }
}
