# Doc 34 — Wallet Integration Paths

Phase 8 UX + infra spec. Extends doc 28 (NFT + wallet UX constraints).

Doc 28 defines guardrails: no wallets required for core features, no secondary market UI, Base L2,
Zora SDK. This doc defines the **full integration path**: tiered usage model, step-by-step UX
flows, API shape, SIWE authentication, social+wallet interplay, and security framing.

---

## 1. Wallet Usage Tiers

MIXHIVE has three wallet tiers. A user can stay at Tier 0 forever without any loss of
functionality. Higher tiers are opt-in and unlock additional provenance/support features.

### Tier 0 — No Wallet (Default, 100% of Users)

All social features, discovery, collab sessions, quests, and audio playback work with zero
crypto. No wallet CTAs on: home feed, discover, search, notifications, the player, the agent
gallery, or any onboarding flow.

### Tier 1 — Wallet Verification (Optional, Read-Only)

User connects a wallet to verify ownership of NFTs they have already received (e.g. a gig
proof auto-minted for them by a creator). This is **read-only** — connecting a wallet at
Tier 1 does not enable minting or spending.

Authentication method: EIP-4361 Sign-In With Ethereum (SIWE). The user signs a
human-readable message in their wallet app — no transaction, no gas, no on-chain event.

UX entry point: Settings → "Web3 & NFTs" section only.

### Tier 2 — Active NFT Participation (Creator/Fan Opt-In)

Wallet required only for:
- Creator: deploying a new NFT collection (minting a limited edition pass)
- Fan: claiming a transferable mix pass (soulbound passes are gas-free and wallet-free)
- Fan: backing a quest with an NFT token

These flows prompt for wallet connection inline — the user only encounters a wallet CTA when
they explicitly navigate to a page and click a button that requires one.

---

## 2. Integration Technology

### 2.1 Wallet Libraries

| Need | Library | License | Cost |
|---|---|---|---|
| SIWE message verification | `@spruceid/siwe-parser` | Apache 2.0 | Free |
| Ethereum provider detection | `window.ethereum` (native browser) | — | Free |
| Transaction signing (Tier 2) | `viem` + `ethers` (already in some deps) | MIT | Free |
| ENS name resolution | `viem` `getEnsName` (calls public RPC) | MIT | Free |

**No Privy.** No WalletConnect cloud. No paid wallet-as-a-service. This complies with
`CLAUDE.md: Do not add paid third-party APIs`.

### 2.2 Wallet Detection

```typescript
// Detect available wallet providers
function detectProviders(): WalletProvider[] {
  const providers: WalletProvider[] = [];
  if (typeof window === 'undefined') return providers;

  const eth = (window as any).ethereum;
  if (!eth) return providers;

  if (eth.isMetaMask) providers.push({ type: 'metamask', provider: eth });
  if (eth.isCoinbaseWallet) providers.push({ type: 'coinbase', provider: eth });
  if (eth.providers) {
    // EIP-5749: multiple injected providers
    providers.push(...eth.providers
      .filter((p: any) => p.isMetaMask || p.isCoinbaseWallet)
      .map((p: any) => ({
        type: p.isMetaMask ? 'metamask' : 'coinbase',
        provider: p,
      })));
  }
  return providers;
}
```

### 2.3 WalletConnect v2 (Future Upgrade)

WalletConnect v2's open-source relay can be self-hosted at zero cost using the Docker image
`walletconnect/relay`. This is a Phase 9 upgrade path for mobile wallet support (QR code
pairing). Not required in Phase 8.

---

## 3. Wallet Connect UX Flow (Tier 1 — SIWE)

Complete step-by-step flow for first wallet connection in Settings.

### Step 1 — Entry Point

Settings page → "Web3 & NFTs" section (shown to all users). Section contains:

- Brief description: "Connect a wallet to verify NFT passes you've received and display your
  on-chain music activity."
- "Connect Wallet" button (only shown if `profile.wallet_address` is null).
- "About NFTs on MIXHIVE" link (opens a help article, no external redirect).

### Step 2 — Provider Selection Modal

`WalletConnectModal` opens with three options:

```
┌─────────────────────────────────────────────┐
│  Connect your wallet                        │
│                                             │
│  ● MetaMask                 [detected ✓]    │
│  ● Coinbase Wallet          [detected ✓]    │
│  ● I don't have a wallet    [get one →]     │
│                                             │
│  [Cancel]                                   │
└─────────────────────────────────────────────┘
```

"I don't have a wallet" → external link to `https://wallet.coinbase.com` (Coinbase's free
non-custodial wallet). Opens in a new tab. The modal remains open.

If no wallet is detected (`detectProviders()` returns empty array), show only the
"I don't have a wallet" option with a brief explanation: "Install MetaMask or Coinbase Wallet
as a browser extension or use the Coinbase Wallet mobile app."

### Step 3 — Address Request

User clicks MetaMask or Coinbase Wallet. MIXHIVE calls:

```typescript
const accounts = await provider.request({ method: 'eth_requestAccounts' });
const address = accounts[0];
```

If the user rejects in the wallet popup: show inline error "Connection rejected. You can try
again any time." Do not close the modal.

### Step 4 — SIWE Message Construction

```typescript
import { SiweMessage } from '@spruceid/siwe-parser';

const message = new SiweMessage({
  domain: 'mixhive.app',
  address,
  statement: 'Sign in to verify your wallet ownership on MixHive. This does not cost any gas.',
  uri: 'https://mixhive.app',
  version: '1',
  chainId: 8453,   // Base L2 mainnet
  nonce: await fetchNonce(),  // GET /api/wallet/nonce — random 32-char hex, stored server-side
  expirationTime: new Date(Date.now() + 3600_000).toISOString(),  // 1 hour
}).prepareMessage();
```

The nonce is fetched from the server (`GET /api/wallet/nonce`) and stored in a server-side
session or Redis with a 1-hour TTL. This prevents replay attacks.

### Step 5 — Signature Request

```typescript
const signature = await provider.request({
  method: 'personal_sign',
  params: [message, address],
});
```

The wallet popup shows the human-readable message. User clicks "Sign" (no gas charge).

### Step 6 — Server Verification

```typescript
// Client
const response = await fetch('/api/wallet/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({ message, signature }),
});
```

Server-side (`POST /api/wallet/connect`):

```typescript
import { SiweMessage } from '@spruceid/siwe-parser';

export async function POST(request: NextRequest) {
  const { message, signature } = await request.json();

  const siwe = new SiweMessage(message);
  const { success, error, data } = await siwe.verify({ signature });

  if (!success) {
    return NextResponse.json({ error: error?.type ?? 'Invalid signature' }, { status: 400 });
  }

  // Verify nonce was issued by us and has not expired
  const nonceValid = await consumeNonce(data.nonce);
  if (!nonceValid) {
    return NextResponse.json({ error: 'Nonce expired or invalid' }, { status: 400 });
  }

  // Store wallet_address on profile
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  await supabase
    .from('profiles')
    .update({ wallet_address: data.address.toLowerCase() })
    .eq('id', user.id);

  // Resolve ENS name (non-blocking)
  const ensName = await resolveEns(data.address).catch(() => null);

  return NextResponse.json({ wallet_address: data.address, ens_name: ensName });
}
```

### Step 7 — Post-Connect State

- Modal closes.
- Settings page now shows: `Connected: 0x1234…abcd` (truncated) + ENS name if resolved.
- Profile page shows a small wallet badge next to display name: `0x1234…abcd` or ENS name.
- Background: `owns_nft_of` graph edges auto-synced on next `/api/cron/nft-sync` run (the
  sync now includes the newly linked `wallet_address` from `profiles`).

---

## 4. Wallet Disconnect + Revocation

**UX:** Settings → Web3 & NFTs → "Disconnect wallet" button.

**Server action (`DELETE /api/wallet/connect`):**

```typescript
export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  // 1. Get current wallet_address
  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('id', user.id)
    .single();

  if (!profile?.wallet_address) {
    return NextResponse.json({ error: 'No wallet connected' }, { status: 400 });
  }

  // 2. Soft-delete owns_nft_of graph edges for this wallet
  //    (keep nft_tokens.holder_address for provenance — on-chain is permanent)
  const { data: artistNode } = await supabase
    .from('mythic_nodes')
    .select('id')
    .eq('node_type', 'artist_profile')
    .eq('external_id', user.id)
    .single();

  if (artistNode) {
    await supabase
      .from('mythic_edges')
      .delete()
      .eq('from_node_id', artistNode.id)
      .eq('edge_type', 'owns_nft_of');
  }

  // 3. Clear wallet_address from profile
  await supabase
    .from('profiles')
    .update({ wallet_address: null })
    .eq('id', user.id);

  return NextResponse.json({ success: true });
}
```

**What is NOT deleted on disconnect:**
- `nft_tokens.holder_address` — the on-chain provenance record is permanent by design.
- The `nft_tokens` rows themselves — they remain as historical records.

The user can reconnect later with the same or a different wallet address.

---

## 5. Social + Wallet Interplay

Connecting a wallet unlocks one optional social feature: **NFT activity in feed**.

### 5.1 Opt-In Feed Activity

After connecting a wallet, the Settings → "Web3 & NFTs" section shows a toggle:
"Show my NFT activity in feed" (default: OFF).

When ON:
- When a user you follow claims or mints an NFT, a feed item of type `nft_mint_activity` appears.
- Format: `[Avatar] DJ Nef released a new edition: "Bunker Sessions Vol. 1"` + thumbnail +
  "View passes" button.
- No price shown. No "floor" or "last sale" data.

When OFF (default): NFT events are completely absent from the feed.

**Implementation:** `nft_mint_activity` feed items are generated by inserting into the
`activities` table (or equivalent feed table) when `nft_collections.status` transitions to
`live`, but only for users who have `show_nft_in_feed = true` in their settings JSON.

### 5.2 Opt-In Analytics

When the user enables NFT feed activity, fire a `experiment_events` insert:

```typescript
trackEvent(profile.id, 'nft_feed_opted_in', 'nft_social', {
  wallet_address: profile.wallet_address,
});
```

This populates the experiment tracking data for measuring NFT feature adoption.

### 5.3 "Backers" on Quest Pages

Quest detail pages show a "N fans are backing this quest" count (if `nft_collection` is linked
to the quest). Clicking shows a list of backer avatars (profiles, not wallet addresses).
Wallet addresses are never shown on social-facing pages.

---

## 6. API Requirements

Two new routes added to the Next.js App Router:

### `GET /api/wallet/nonce`

Returns a random 32-character hex nonce. Stores it server-side with a 1-hour TTL.

```typescript
export async function GET() {
  const nonce = crypto.randomBytes(16).toString('hex');
  // Store in Redis / KV with TTL, or in a DB table with created_at
  await storeNonce(nonce);
  return NextResponse.json({ nonce });
}
```

### `POST /api/wallet/connect`

Verifies SIWE message + signature. Updates `profiles.wallet_address`. Returns
`{ wallet_address, ens_name? }`. Full implementation in §3 Step 6.

### `DELETE /api/wallet/connect`

Clears wallet from profile and soft-deletes `owns_nft_of` edges. Full implementation in §4.

---

## 7. Security & Compliance Framing

### 7.1 What MIXHIVE Never Does

| Risk | Mitigation |
|---|---|
| Store private keys | Server never receives a private key; only the signed message and signature |
| Enable speculative trading | No buy/sell/price UI anywhere in the application |
| Show price data | No floor price, last sale, estimated value fields in schema or UI |
| Force wallet for core features | Tier 0 covers 100% of social/discovery/audio features |
| Expose wallet address publicly | Wallet address shown only on own profile page (truncated); not in feed |

### 7.2 SIWE Security Properties

- **Nonce:** One-time use, server-issued, 1-hour TTL. Prevents replay attacks.
- **Expiration:** `expirationTime` in the SIWE message. Server rejects expired messages.
- **Domain binding:** SIWE message includes `domain: 'mixhive.app'`. Wallets warn users if
  the signing domain doesn't match the current page's domain.
- **Chain ID:** Hardcoded to Base L2 (`8453`). Mismatched chain ID → signature invalid.

### 7.3 Schema Requirements

`profiles.wallet_address` column:
- Type: `VARCHAR(42)` (exact length of an Ethereum address including `0x` prefix)
- Stored lowercase: always `toLowerCase()` before insert
- Nullable: `TRUE` (Tier 0 users have no wallet)
- Unique index: prevents two profiles claiming the same address

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42),
  ADD CONSTRAINT wallet_address_format CHECK (
    wallet_address IS NULL OR wallet_address ~ '^0x[0-9a-f]{40}$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_wallet_address
  ON profiles (wallet_address)
  WHERE wallet_address IS NOT NULL;
```

### 7.4 Risk Disclosures

For any flow where a user takes an on-chain action (Tier 2 only), MIXHIVE shows a
plain-language disclosure before the wallet transaction is signed:

> "This action creates a record on the Base blockchain. It cannot be undone. MIXHIVE covers
> the gas fee for this transaction — you will not be charged."

For soulbound tokens: additionally show "This token cannot be transferred or sold."

---

## 8. Codex & Claude Code Handoff

**Codex handoff:**

Migration (e.g. 070):
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42),
  ADD COLUMN IF NOT EXISTS show_nft_in_feed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT wallet_address_format CHECK (
    wallet_address IS NULL OR wallet_address ~ '^0x[0-9a-f]{40}$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_wallet_address
  ON profiles (wallet_address)
  WHERE wallet_address IS NOT NULL;
```

New routes to implement:
- `src/app/api/wallet/nonce/route.ts` — GET, no auth required, returns nonce
- `src/app/api/wallet/connect/route.ts` — POST (SIWE verify + update profile) + DELETE (disconnect)

**Claude Code handoff:**

- Update `WalletConnectModal.tsx` to implement the full 7-step SIWE flow described in §3
  (currently the modal shows 3 provider options but does not call SIWE or POST to the server).
- Add "Web3 & NFTs" section to `src/views/SettingsView.tsx` (or wherever settings are rendered):
  - Wallet connect/disconnect UI
  - "Show my NFT activity in feed" toggle
- Add wallet address badge to `EnhancedProfilePage.tsx` (own profile only, truncated address
  or ENS name, shown below display name).
- Add `@spruceid/siwe-parser` to `package.json` dependencies.
