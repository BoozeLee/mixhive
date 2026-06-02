// Server-side NFT service abstraction layer (doc 36).
// All Supabase calls are service-role; never import this from client code.

import { createServerClient } from '@/lib/supabase';

export interface CreateCollectionInput {
  owner_id: string;
  name: string;
  description?: string;
  image_url?: string;
  max_supply?: number;
  soulbound?: boolean;
  mix_id?: string;
  quest_id?: string;
  event_node_id?: string;
}

export interface CollectionResult {
  collection_id: string;
  status: 'deploying';
}

export interface MintResult {
  token_id: string;
  /** pending_mint = minted_at IS NULL; live = on-chain confirmed */
  status: 'pending_mint' | 'live';
}

export interface Holder {
  token_id: string;
  holder_address: string | null;
  holder_profile: string | undefined;
  minted_at: string | null;
}

export interface SyncResult {
  new_tokens: number;
  sync_cursor: number;
}

/**
 * Insert a new collection row with status='deploying'.
 * Actual on-chain deployment is handled by the nft-sync cron once a
 * contract address is assigned (by the Zora SDK worker).
 */
export async function createCollection(input: CreateCollectionInput): Promise<CollectionResult> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('nft_collections')
    .insert({
      owner_id:      input.owner_id,
      name:          input.name,
      description:   input.description ?? null,
      image_url:     input.image_url ?? null,
      max_supply:    input.max_supply ?? null,
      soulbound:     input.soulbound ?? false,
      mix_id:        input.mix_id ?? null,
      quest_id:      input.quest_id ?? null,
      event_node_id: input.event_node_id ?? null,
      status:        'deploying',
      chain:         'base',
      token_standard: 'ERC1155',
    })
    .select('id')
    .single();

  if (error) throw error;
  return { collection_id: data.id, status: 'deploying' };
}

/**
 * Create a pending token claim record.
 * minted_at stays null until the sync cron confirms the on-chain Transfer event.
 */
export async function mintToken(
  collectionId: string,
  holderAddress: string,
  options?: { holderProfile?: string }
): Promise<MintResult> {
  const supabase = createServerClient();

  const { data: collection, error: collErr } = await supabase
    .from('nft_collections')
    .select('id, max_supply, soulbound')
    .eq('id', collectionId)
    .single();

  if (collErr || !collection) throw collErr ?? new Error('Collection not found');

  if (collection.max_supply) {
    const { count } = await supabase
      .from('nft_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);
    if ((count ?? 0) >= collection.max_supply) {
      throw new Error('Supply exhausted');
    }
  }

  const { data, error } = await supabase
    .from('nft_tokens')
    .insert({
      collection_id:  collectionId,
      holder_address: holderAddress.toLowerCase(),
      holder_profile: options?.holderProfile ?? null,
      soulbound:      collection.soulbound,
    })
    .select('id, minted_at')
    .single();

  if (error) throw error;
  return {
    token_id: data.id,
    status:   data.minted_at ? 'live' : 'pending_mint',
  };
}

/** Return all token holders for a collection, newest first. */
export async function getTokenHolders(collectionId: string): Promise<Holder[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('nft_tokens')
    .select('id, holder_address, holder_profile, minted_at')
    .eq('collection_id', collectionId)
    .order('minted_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(r => ({
    token_id:       r.id,
    holder_address: r.holder_address,
    holder_profile: r.holder_profile ?? undefined,
    minted_at:      r.minted_at,
  }));
}

/**
 * True if the profile owns any token in the collection.
 * Checks both holder_profile (linked account) and holder_address (wallet).
 */
export async function verifyTokenOwnership(
  profileId: string,
  collectionId: string
): Promise<boolean> {
  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('id', profileId)
    .single();

  const filter = profile?.wallet_address
    ? `holder_profile.eq.${profileId},holder_address.eq.${profile.wallet_address.toLowerCase()}`
    : `holder_profile.eq.${profileId}`;

  const { count } = await supabase
    .from('nft_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collectionId)
    .or(filter);

  return (count ?? 0) > 0;
}

/**
 * Advance the sync cursor for a collection.
 * In Phase 9 experiments no live Zora contract exists yet, so this is a
 * no-op placeholder — the cron calls it to advance the cursor and the
 * body is where the Zora Transfer-event poll will live in Phase 10+.
 */
export async function syncCollection(
  collectionId: string,
  fromBlock: number
): Promise<SyncResult> {
  const supabase = createServerClient();

  const { data: collection } = await supabase
    .from('nft_collections')
    .select('contract_address')
    .eq('id', collectionId)
    .single();

  if (!collection?.contract_address) {
    return { new_tokens: 0, sync_cursor: fromBlock };
  }

  await supabase
    .from('nft_collections')
    .update({ sync_cursor: fromBlock })
    .eq('id', collectionId);

  return { new_tokens: 0, sync_cursor: fromBlock };
}
