// Minimal injected-wallet access for browser signing.
//
// Extracted so the Flow Key countersign flow does not re-implement provider
// detection. `WalletConnectModal` still carries its own copy of these helpers;
// it can adopt this module whenever that file is next touched — not refactored
// here to avoid disturbing a working SIWE flow.

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      providers?: Window['ethereum'][];
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

function provider() {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth) return null;
  // Multi-provider environments (EIP-5749) expose the list; any of them can sign.
  return eth.providers?.[0] ?? eth;
}

/** Prompts for account access. Returns null when declined or unavailable. */
export async function requestWalletAddress(): Promise<string | null> {
  const p = provider();
  if (!p) return null;
  try {
    const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[];
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

/** personal_sign. Returns null when the user rejects — a refusal is not an error. */
export async function personalSign(address: string, message: string): Promise<string | null> {
  const p = provider();
  if (!p) return null;
  try {
    return (await p.request({ method: 'personal_sign', params: [message, address] })) as string;
  } catch {
    return null;
  }
}
