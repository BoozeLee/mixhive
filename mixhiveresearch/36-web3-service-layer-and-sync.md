# Doc 36: Web3 Service Layer & Sync

> **Phase 9 — Blockchain Integration & Experiments**
>
> This document specifies the concrete backend implementation layer for web3
> operations in MIXHIVE. Doc 28 defined the abstract interface; doc 32 defined
> sync architecture at a high level. This doc is the Codex implementation handoff:
> exact TypeScript signatures, Zora SDK usage patterns, sync cron spec, and
> embedded wallet integration.
>
> **Does NOT duplicate:** doc 28 (philosophy, use cases, abstract interface outline),
> doc 32 (creator governance, co-creator approvals, provenance receipt format),
> doc 34 (SIWE flow, T0/T1/T2 tiers, wallet connect UX).

---

## 1. `src/lib/nft-service.ts` — Full Interface Specification

### 1.1 Type Definitions

```typescript
// Input types
export interface CreateCollectionInput {
  ownerId: string;           // profiles.id — must be service-role caller
  sourceType: 'mix' | 'quest' | 'event';
  sourceId: string;          // uuid of the mix/quest/event
  name: string;
  description: string;
  maxSupply: number;         // 1–10000; 0 = unlimited
  soulbound: boolean;        // true → ERC-5192, no transfers
  chain?: 'base';            // default 'base'; only Base in Phase 9
  coCreators?: CoCreator[];  // optional, from co_creator_approvals
}

export interface CoCreator {
  profileId: string;
  walletAddress: string;     // must be validated hex address
  royaltyShareBps: number;   // basis points; sum across co-creators + owner must = 10000
}

export interface MintInput {
  collectionId: string;
  holderAddress: string;     // validated 0x... address
  holderProfileId?: string;  // if holder is a MIXHIVE user; links nft_tokens.holder_profile
  tokenMetadata?: Record<string, unknown>; // extra IPFS metadata fields
}

// Result types
export interface CollectionResult {
  collectionId: string;
  contractAddress: string | null; // null until on-chain deploy confirmed
  status: 'deploying' | 'live' | 'failed';
  error?: string;
}

export interface MintResult {
  tokenId: string;           // internal uuid; on-chain tokenId in nft_tokens.token_id
  txHash: string | null;     // null until confirmed
  status: 'pending' | 'minted' | 'failed';
  error?: string;
}

export interface Holder {
  tokenId: string;           // on-chain token ID
  holderAddress: string;
  holderProfileId: string | null;
  holderUsername: string | null;
  holderDisplayName: string | null;
  mintedAt: string;
  soulbound: boolean;
}

export interface SyncResult {
  newMints: number;
  transfersUpdated: number;
  newSyncCursor: number;     // block number
  errors: string[];
}
```

### 1.2 `createCollection(input: CreateCollectionInput): Promise<CollectionResult>`

**SQL side-effects:**
1. Insert row into `nft_collections` with `status='deploying'`
2. Store `input.coCreators` into `nft_collections.co_creator_approvals` JSONB
3. Enqueue Zora SDK `createContract()` call asynchronously (see §2)
4. On Zora callback: update `contract_address` + `status='live'` or `status='failed'`

**Validation:**
- `ownerId` must match caller's JWT subject (enforced by RLS); service-role bypasses
- `maxSupply` between 1 and 10,000; 0 means open edition
- `name` max 100 chars; `description` max 1,000 chars
- Co-creator royalty shares must sum to ≤10,000 bps (owner gets remainder)

**Error codes:**

| Code | Meaning |
|---|---|
| `owner_not_found` | `ownerId` not in `profiles` |
| `source_not_found` | `sourceId` not in mixes/quests/events |
| `supply_out_of_range` | `maxSupply` < 0 or > 10000 |
| `chain_deploy_failed` | Zora SDK threw after 3 retries |
| `co_creator_wallet_invalid` | A co-creator wallet address failed checksum |

### 1.3 `mintToken(input: MintInput): Promise<MintResult>`

**SQL side-effects:**
1. Check `nft_collections.status = 'live'` and `nft_collections.max_supply` not exceeded
2. Insert `nft_tokens` row with `status='pending'`, `tx_hash=null`
3. Enqueue Zora SDK `mint()` call asynchronously
4. On confirmation: update `token_id`, `tx_hash`, `status='minted'`
5. Upsert `owns_nft_of` edge in `mythic_edges` if `holderProfileId` is set

**Error codes:**

| Code | Meaning |
|---|---|
| `collection_not_live` | Collection is deploying, paused, or failed |
| `supply_exhausted` | `max_supply > 0` and current token count >= max_supply |
| `already_holds_token` | `holderAddress` already has a token in this collection (1-per-wallet for passes) |
| `mint_failed` | On-chain transaction reverted after 3 retries |

### 1.4 `getTokenHolders(collectionId: string): Promise<Holder[]>`

Reads from `nft_tokens` with `LEFT JOIN profiles ON profiles.id = nft_tokens.holder_profile`.
Returns only rows with `status='minted'`.

No on-chain call — this is a DB read. For real-time accuracy, the caller should
ensure `syncCollection` has run recently (within the last hour via cron).

### 1.5 `verifyTokenOwnership(profileId: string, collectionId: string): Promise<boolean>`

```typescript
// Implementation:
const row = await supabase
  .from('nft_tokens')
  .select('id')
  .eq('collection_id', collectionId)
  .eq('holder_profile', profileId)
  .eq('status', 'minted')
  .limit(1)
  .maybeSingle();
return row.data !== null;
```

Used for gating collab session access. Does NOT re-verify on-chain for every call —
trusts the DB cache. If a user has transferred their token away and the cron hasn't
synced yet, there is a short window (≤1 hour) where the DB shows ownership that
no longer exists on-chain. This is acceptable for Phase 9; re-evaluate for
high-value access gating in Phase 10.

### 1.6 `syncCollection(collectionId: string, fromBlock: number): Promise<SyncResult>`

See §3 for full cron design. This function is called by the cron route; it can
also be called ad-hoc for a specific collection (e.g. after a known mint).

---

## 2. Zora Protocol SDK Integration

### 2.1 Installation

```bash
npm install @zoralabs/protocol-sdk viem
# viem is a peer dependency; already in package.json via wagmi if present
```

Pin the version at install time. Do not use `latest` — Zora SDK has breaking
releases across minor versions.

### 2.2 Contract Deployment Pattern

```typescript
import { createCreatorClient } from '@zoralabs/protocol-sdk';
import { createWalletClient, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Server-side only — NFT_SIGNER_KEY never exposed to client
const signerAccount = privateKeyToAccount(process.env.NFT_SIGNER_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL), // Alchemy/Infura/public Base RPC
});

const walletClient = createWalletClient({
  account: signerAccount,
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

const creatorClient = createCreatorClient({ chainId: base.id, publicClient });

// Deploy a new 1155 collection
const { parameters, contractAddress } = await creatorClient.create1155({
  contract: {
    name: collectionInput.name,
    uri: ipfsMetadataUri, // uploaded before this call
  },
  token: {
    tokenMetadataURI: ipfsMetadataUri,
    maxSupply: BigInt(collectionInput.maxSupply),
    royaltyBPS: 500, // 5% creator royalty
    createReferral: process.env.ZORA_CREATE_REFERRAL_ADDRESS,
  },
});

// Simulate + send
const { request } = await publicClient.simulateContract(parameters);
const txHash = await walletClient.writeContract(request);

// Wait for receipt (non-blocking in production — use fire-and-forget + webhook)
const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
```

### 2.3 Async Fire-and-Forget Pattern

On-chain transactions take 2–15 seconds. API routes must not block waiting for
chain confirmation. Pattern:

1. API route inserts DB row with `status='deploying'`
2. API route returns `202 Accepted` with `{ collectionId, status: 'deploying' }`
3. Background: Next.js background task (or Vercel Queue if available) runs the
   Zora SDK call
4. On success: update `status='live'`, `contract_address=<address>`
5. On failure after 3 retries with exponential backoff (1s, 4s, 16s):
   update `status='failed'`, `props.error=<message>`
6. UI polls `GET /api/nft/collections/[id]` every 3 seconds while status is
   `'deploying'` — NftMintModal already has a polling spinner

### 2.4 Gas Sponsorship for Soulbound Tokens

For soulbound tokens (gig proofs), MIXHIVE sponsors gas via EIP-4337 paymaster:

```typescript
import { createBundlerClient } from 'viem/account-abstraction';
import { toZeroDevSmartAccount } from '@zerodev/sdk';

// Embedded wallet holder's smart account
const smartAccount = await toZeroDevSmartAccount({
  client: publicClient,
  owners: [holderEOA], // holder's embedded wallet address
});

const bundlerClient = createBundlerClient({
  account: smartAccount,
  transport: http(process.env.ZERODEV_BUNDLER_URL),
  // Paymaster sponsorship:
  paymaster: {
    getPaymasterData: async () => ({
      paymaster: process.env.PAYMASTER_ADDRESS,
      paymasterData: '0x',
    }),
  },
});

// Gas is sponsored by MIXHIVE paymaster; holder pays $0
const userOpHash = await bundlerClient.sendUserOperation({ calls: [mintCall] });
```

**When to sponsor gas:**
- Always for soulbound gig-proof tokens
- Never for regular edition passes (creator or fan pays own gas)
- Optionally for embedded wallet holders on first claim (UX subsidy)

### 2.5 Error Handling & Retry Logic

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(4, attempt) * 1000));
      }
    }
  }
  throw lastError;
}
```

After exhausting retries: log the error to `nft_collections.props.error` or
`nft_tokens.props.error`, set status to `'failed'`, and surface to user in
NftMintModal with a "Try again" button.

---

## 3. On-Chain Sync Cron — `/api/cron/nft-sync`

### 3.1 Vercel Cron Configuration

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/nft-sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

The route must validate the `Authorization: Bearer <CRON_SECRET>` header that
Vercel injects on cron invocations. Reject any request without it.

### 3.2 Sync Algorithm

```typescript
// /api/cron/nft-sync/route.ts (pseudocode)
export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (process.env.WEB3_EXPERIMENTS_ENABLED !== 'true') {
    return NextResponse.json({ skipped: true });
  }

  // Fetch all live collections needing sync
  const { data: collections } = await supabase
    .from('nft_collections')
    .select('id, contract_address, sync_cursor, chain, soulbound')
    .eq('status', 'live')
    .not('contract_address', 'is', null);

  const results = await Promise.allSettled(
    collections.map(c => syncCollection(c.id, c.sync_cursor ?? 0))
  );

  return NextResponse.json({ synced: results.length });
}
```

### 3.3 `syncCollection` Implementation

```typescript
async function syncCollection(
  collectionId: string,
  fromBlock: number
): Promise<SyncResult> {
  const collection = await getCollection(collectionId);
  const currentBlock = await publicClient.getBlockNumber();
  const toBlock = Number(currentBlock);

  // Fetch Transfer events from Base
  const logs = await publicClient.getLogs({
    address: collection.contractAddress as `0x${string}`,
    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
    fromBlock: BigInt(fromBlock),
    toBlock: BigInt(toBlock),
  });

  let newMints = 0;
  let transfersUpdated = 0;
  const errors: string[] = [];

  for (const log of logs) {
    const { from, to, tokenId } = log.args;
    const tokenIdStr = tokenId.toString();

    if (from === '0x0000000000000000000000000000000000000000') {
      // New mint: from=0x0 means token was created
      const holderProfile = await resolveProfileByWallet(to as string);
      await supabase.from('nft_tokens').upsert({
        collection_id: collectionId,
        token_id: tokenIdStr,
        holder_address: to,
        holder_profile: holderProfile?.id ?? null,
        status: 'minted',
        tx_hash: log.transactionHash,
        minted_at: new Date().toISOString(),
      }, { onConflict: 'collection_id,token_id' });

      // Upsert MythicNode edge
      if (holderProfile) {
        await upsertOwnsNftOfEdge(holderProfile.id, collectionId);
      }
      newMints++;
    } else if (!collection.soulbound) {
      // Secondary transfer (only for non-soulbound tokens)
      await supabase
        .from('nft_tokens')
        .update({ holder_address: to, holder_profile: (await resolveProfileByWallet(to as string))?.id ?? null })
        .eq('collection_id', collectionId)
        .eq('token_id', tokenIdStr);
      transfersUpdated++;
    }
    // Soulbound transfers from non-zero address are ignored (contract blocks them anyway)
  }

  // Update sync cursor to latest block
  await supabase
    .from('nft_collections')
    .update({ sync_cursor: toBlock })
    .eq('id', collectionId);

  return { newMints, transfersUpdated, newSyncCursor: toBlock, errors };
}
```

### 3.4 MythicNode Edge Upsert

```typescript
async function upsertOwnsNftOfEdge(profileId: string, collectionId: string) {
  // Get or create the profile's artist_profile node
  const { data: profileNode } = await supabase
    .from('mythic_nodes')
    .select('id')
    .eq('node_type', 'artist_profile')
    .eq('source_table', 'profiles')
    .eq('source_id', profileId)
    .maybeSingle();

  // Get or create the nft_collection node
  const { data: collectionNode } = await supabase
    .from('mythic_nodes')
    .select('id')
    .eq('node_type', 'nft_collection')
    .eq('source_table', 'nft_collections')
    .eq('source_id', collectionId)
    .maybeSingle();

  if (!profileNode || !collectionNode) return;

  await supabase.from('mythic_edges').upsert({
    from_node_id: profileNode.id,
    to_node_id: collectionNode.id,
    edge_type: 'owns_nft_of',
    weight: 1.0,
    metadata: { synced_at: new Date().toISOString() },
  }, { onConflict: 'from_node_id,to_node_id,edge_type' });
}
```

### 3.5 Chain Reorg Handling

Base achieves practical finality in ~2 seconds (L2 sequencer) and economic
finality within ~7 days via fraud proof window. For Phase 9, the risk of a
reorg affecting already-minted tokens is negligible.

Rule: only process events from blocks older than 6 confirmations:
```typescript
const safeBlock = Number(currentBlock) - 6;
const toBlock = Math.min(safeBlock, fromBlock + 10_000); // cap at 10k blocks per run
```

If a transfer event is later contradicted by a reorg (detected on next sync run),
soft-delete the affected `nft_tokens` row and remove the `owns_nft_of` edge.
Log the incident to `nft_collections.props.incident_log`.

---

## 4. Embedded Wallet Integration (ZeroDev)

### 4.1 Installation

```bash
npm install @zerodev/sdk @zerodev/social-wallet @zerodev/ecdsa-validator
# Peer deps already in package.json: viem, @tanstack/react-query
```

### 4.2 `wallet_links` Table — Schema

The existing `profiles.wallet_address` column (single-wallet model from doc 34)
is deprecated for new writes. A new `wallet_links` table supports multiple wallets
per profile (external + embedded):

```sql
-- Migration 072 (Codex to implement)
create table if not exists public.wallet_links (
  id            uuid        primary key default gen_random_uuid(),
  profile_id    uuid        not null references public.profiles(id) on delete cascade,
  wallet_address varchar(42) not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  chain         text        not null default 'base',
  wallet_type   text        not null check (wallet_type in ('embedded', 'external')),
  created_at    timestamptz not null default now(),
  unique (profile_id, wallet_address)
);

create index idx_wallet_links_profile on public.wallet_links (profile_id);
create index idx_wallet_links_address on public.wallet_links (wallet_address);

alter table public.wallet_links enable row level security;
drop policy if exists "user own wallet links" on public.wallet_links;
create policy "user own wallet links"
  on public.wallet_links for all
  using (profile_id = auth.uid());

-- Backward compatibility: profiles.wallet_address continues to work for reads
-- New writes use wallet_links; profiles.wallet_address is populated from
-- the most recent wallet_links row for that profile via a trigger:
create or replace function public.sync_wallet_address_from_links()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles
  set wallet_address = new.wallet_address
  where id = new.profile_id;
  return new;
end;
$$;

drop trigger if exists on_wallet_link_insert on public.wallet_links;
create trigger on_wallet_link_insert
  after insert on public.wallet_links
  for each row execute function public.sync_wallet_address_from_links();
```

### 4.3 Embedded Wallet Creation Flow

**Server-side session endpoint** (`/api/wallet/embedded-session`):
```typescript
// POST /api/wallet/embedded-session
// Returns a ZeroDev session token for the authenticated user
import { createKernelAccountClient } from '@zerodev/sdk';

export async function POST(req: NextRequest) {
  const { user } = await getServerSession(req); // supabase session
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // ZeroDev social wallet session (OAuth OIDC flow)
  // The user's Supabase JWT is used as the OIDC token
  const sessionConfig = {
    projectId: process.env.ZERODEV_PROJECT_ID,
    jwt: user.access_token, // Supabase JWT as OIDC credential
  };

  // ZeroDev creates/retrieves the deterministic smart wallet address
  // No private key is generated on MIXHIVE servers
  const walletAddress = await getOrCreateZeroDevWallet(sessionConfig);

  return NextResponse.json({ walletAddress, walletType: 'embedded' });
}
```

**Client-side Settings flow:**
1. User navigates to Settings → "Web3 & NFTs"
2. Clicks "Enable Web3 features (no wallet required)"
3. `POST /api/wallet/embedded-session` — returns wallet address
4. `POST /api/wallet/connect` called with `{ walletAddress, walletType: 'embedded' }` —
   inserts into `wallet_links`, sets `profiles.web3_tier = 1`
5. Settings shows: "Embedded wallet: `0xABCD...1234` · No fees · Powered by ZeroDev"
6. No key export UI in Phase 9 (advanced feature for Phase 10)

### 4.4 Gas Sponsorship via Alto Self-Hosted Bundler

For production at scale, use the open-source Alto bundler instead of a cloud
paymaster to eliminate API costs:

```bash
# docker-compose.yml addition:
alto:
  image: pimlicolabs/alto:latest
  environment:
    - RPC_URL=https://base-rpc.publicnode.com
    - ENTRYPOINT_ADDRESS=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
    - EXECUTOR_PRIVATE_KEY=${ALTO_EXECUTOR_KEY}
    - MIN_BALANCE=0.01 # ETH balance to maintain for gas
  ports:
    - "3030:3030"
```

In `process.env.ZERODEV_BUNDLER_URL` = `http://alto:3030` in production Docker.
In Vercel production (no Docker), use Pimlico free tier bundler until volume
exceeds 1,000 daily UserOps — then evaluate self-hosted.

---

## 5. Codex Implementation Handoff

### Migration 072 (schema)
- `wallet_links` table (§4.2 DDL above)
- `profiles.web3_tier int default 0` column
- Trigger `sync_wallet_address_from_links` for backward compat

### New files
- `src/lib/nft-service.ts` — full service implementation per §1 interface
- `src/app/api/cron/nft-sync/route.ts` — cron handler per §3.2
- `src/app/api/wallet/embedded-session/route.ts` — ZeroDev session endpoint per §4.3

### Modified files
- `src/app/api/nft/collections/route.ts` — add `WEB3_EXPERIMENTS_ENABLED` guard
- `src/app/api/nft/collections/[id]/mint/route.ts` — add guard; call `nft-service.mintToken`
- `vercel.json` — add cron entry for `/api/cron/nft-sync`

---

*Resolves: Phase 9 doc 36 — nft-service.ts interface spec, Zora SDK integration, sync cron, embedded wallet*
