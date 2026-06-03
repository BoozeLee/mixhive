'use client';

import { useState } from 'react';
import { Modal } from './ui/Modal';
import { HiveButton } from './hive/HiveButton';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (address: string) => void;
}

type WalletOption = 'metamask' | 'coinbase' | 'email';
type Step = 'choose' | 'signing' | 'email';

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

function detectProvider(type: 'metamask' | 'coinbase') {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth) return null;

  // Multi-provider env (EIP-5749)
  if (eth.providers) {
    return (
      eth.providers.find(p => (type === 'metamask' ? p.isMetaMask : p.isCoinbaseWallet)) ?? null
    );
  }

  if (type === 'metamask' && eth.isMetaMask) return eth;
  if (type === 'coinbase' && eth.isCoinbaseWallet) return eth;
  // Fall back to whatever is injected — works for most single-provider setups
  return eth;
}

async function requestAddress(type: 'metamask' | 'coinbase'): Promise<string | null> {
  const provider = detectProvider(type);
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

async function signMessage(
  type: 'metamask' | 'coinbase',
  address: string,
  message: string
): Promise<string | null> {
  const provider = detectProvider(type);
  if (!provider) return null;
  try {
    return (await provider.request({
      method: 'personal_sign',
      params: [message, address],
    })) as string;
  } catch {
    return null;
  }
}

function buildSiweMessage(address: string, nonce: string): string {
  const domain = typeof window !== 'undefined' ? window.location.host : 'mixhive.app';
  const uri = typeof window !== 'undefined' ? window.location.origin : 'https://mixhive.app';
  const expiry = new Date(Date.now() + 3_600_000).toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to verify your wallet ownership on MIXHIVE.',
    'This does not cost any gas.',
    '',
    `URI: ${uri}`,
    'Version: 1',
    'Chain ID: 8453',
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    `Expiration Time: ${expiry}`,
  ].join('\n');
}

export function WalletConnectModal({ isOpen, onClose, onConnected }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [connecting, setConnecting] = useState<WalletOption | null>(null);
  const [email, setEmail] = useState('');

  async function handleWallet(type: 'metamask' | 'coinbase') {
    const provider = detectProvider(type);
    if (!provider) {
      toast.error(
        type === 'metamask'
          ? 'MetaMask not detected. Install the browser extension and try again.'
          : 'Coinbase Wallet not detected. Install it and try again.'
      );
      return;
    }

    setConnecting(type);
    setStep('signing');

    try {
      const address = await requestAddress(type);
      if (!address) {
        toast.error('Connection cancelled.');
        setStep('choose');
        return;
      }

      // Fetch nonce from server
      const nonceRes = await fetch('/api/wallet/nonce');
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = buildSiweMessage(address, nonce);
      const signature = await signMessage(type, address, message);
      if (!signature) {
        toast.error('Signing cancelled. Your wallet was not connected.');
        setStep('choose');
        return;
      }

      // Verify on server and link to profile
      const verifyRes = await fetch('/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const { error } = (await verifyRes.json()) as { error: string };
        toast.error(error ?? 'Wallet verification failed. Please try again.');
        setStep('choose');
        return;
      }

      const { wallet_address } = (await verifyRes.json()) as {
        wallet_address: string;
        ens_name?: string;
      };
      toast.success('Wallet connected');
      onConnected(wallet_address);
      onClose();
    } catch {
      toast.error('Something went wrong. Please try again.');
      setStep('choose');
    } finally {
      setConnecting(null);
    }
  }

  async function handleEmail() {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setConnecting('email');
    try {
      const res = await fetch('/api/nft/wallet/create-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Embedded wallet not available yet');
      const { address } = (await res.json()) as { address: string };
      toast.success('Wallet created');
      onConnected(address);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Wallet creation failed');
    } finally {
      setConnecting(null);
    }
  }

  const title = step === 'signing' ? 'Waiting for signature…' : 'Connect Wallet';
  const description =
    step === 'signing'
      ? 'Check your wallet for a sign-in request. This does not cost any gas.'
      : 'NFTs are optional. You can use MIXHIVE without a wallet.';

  return (
    <Modal open={isOpen} onClose={onClose} title={title} description={description} width={420}>
      {step === 'signing' && (
        <div style={{ textAlign: 'center', padding: `${space[8]}px 0` }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: `3px solid ${colors.accentMuted}`,
              borderTopColor: colors.accent,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto',
            }}
          />
          <p style={{ marginTop: space[5], fontSize: fontSize.sm, color: colors.text.muted }}>
            Approve the sign-in request in your wallet…
          </p>
          <button
            onClick={() => {
              setStep('choose');
              setConnecting(null);
            }}
            style={{
              marginTop: space[4],
              background: 'none',
              border: 'none',
              color: colors.text.faint,
              cursor: 'pointer',
              fontSize: fontSize.xs,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {step === 'choose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
          <WalletOptionButton
            icon="🦊"
            label="MetaMask"
            description="Browser extension"
            loading={connecting === 'metamask'}
            onClick={() => handleWallet('metamask')}
          />
          <WalletOptionButton
            icon="🔵"
            label="Coinbase Wallet"
            description="Easy Base onramp via Apple Pay / card"
            loading={connecting === 'coinbase'}
            onClick={() => handleWallet('coinbase')}
          />
          <WalletOptionButton
            icon="✉️"
            label="Continue with email"
            description="No extension needed — we create a wallet for you"
            loading={false}
            onClick={() => setStep('email')}
          />
          <a
            href="https://wallet.coinbase.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: fontSize.xs,
              color: colors.text.faint,
              textDecoration: 'underline',
              marginTop: space[1],
            }}
          >
            I don't have a wallet — get one free ↗
          </a>
        </div>
      )}

      {step === 'email' && (
        <div>
          <button
            onClick={() => setStep('choose')}
            style={{
              background: 'none',
              border: 'none',
              color: colors.text.muted,
              cursor: 'pointer',
              fontSize: fontSize.sm,
              padding: 0,
              marginBottom: space[4],
            }}
          >
            ← Back
          </button>
          <label
            style={{
              display: 'block',
              fontSize: fontSize.sm,
              color: colors.text.secondary,
              marginBottom: space[2],
            }}
          >
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.sm,
              color: colors.text.primary,
              fontSize: fontSize.md,
              marginBottom: space[4],
              boxSizing: 'border-box',
            }}
          />
          <HiveButton
            variant="primary"
            onClick={handleEmail}
            disabled={connecting === 'email' || !email.trim()}
            style={{ width: '100%' }}
          >
            {connecting === 'email' ? 'Creating wallet…' : 'Create embedded wallet'}
          </HiveButton>
        </div>
      )}
    </Modal>
  );
}

function WalletOptionButton({
  icon,
  label,
  description,
  loading,
  onClick,
}: {
  icon: string;
  label: string;
  description: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        width: '100%',
        padding: `${space[3]}px ${space[4]}px`,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        cursor: loading ? 'wait' : 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = colors.gold;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: colors.text.primary,
          }}
        >
          {loading ? 'Connecting…' : label}
        </div>
        <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{description}</div>
      </div>
    </button>
  );
}
