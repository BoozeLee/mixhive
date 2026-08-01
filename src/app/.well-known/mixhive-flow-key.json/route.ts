import { NextResponse } from 'next/server';
import { loadVerificationKeys } from '@/lib/flow-key/seal';

// Public: this is what makes a spore verifiable offline by anyone, with no
// database, no chain, and no account. Never serves a private key.
export async function GET() {
  const keys = loadVerificationKeys().map(k => ({
    key_id: k.keyId,
    public_key_pem: k.publicKeyPem,
  }));
  return NextResponse.json(
    { algorithm: 'ed25519', canonicalization: 'RFC8785', keys },
    { headers: { 'cache-control': 'public, max-age=300' } }
  );
}
