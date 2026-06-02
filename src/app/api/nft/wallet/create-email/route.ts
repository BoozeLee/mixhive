import { NextResponse } from 'next/server';

// Embedded email-wallet creation requires a paid custodial service (e.g. Privy).
// Per project constraints (no paid APIs), this endpoint is intentionally unimplemented.
// The UI surfaces a clear error; users are directed to install MetaMask or Coinbase Wallet.
export async function POST() {
  return NextResponse.json(
    { error: 'Embedded wallet creation is not available. Install MetaMask or Coinbase Wallet to continue.' },
    { status: 501 }
  );
}
