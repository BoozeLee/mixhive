import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

// Hourly NFT sync cron: polls Zora API for Transfer events on live collections,
// updates nft_tokens.holder_address, and creates/updates owns_nft_of graph edges.
//
// Triggered by Vercel cron in vercel.json: { "path": "/api/cron/nft-sync", "schedule": "0 * * * *" }
// Protected by CRON_SECRET env var (Vercel sets Authorization header automatically).

interface ZoraTransferEvent {
  tokenId: string;
  toAddress: string;
  fromAddress: string;
  blockNumber: number;
  txHash: string;
}

async function fetchZoraTransfers(
  contractAddress: string,
  fromBlock: number
): Promise<{ events: ZoraTransferEvent[]; latestBlock: number }> {
  // Zora's public Graph endpoint for Base L2
  const query = `
    query Transfers($contract: String!, $fromBlock: Int!) {
      transferEvents(
        where: { contractAddress: $contract, blockNumber_gte: $fromBlock }
        orderBy: blockNumber
        first: 200
      ) {
        tokenId
        toAddress
        fromAddress
        blockNumber
        txHash: transactionHash
      }
    }
  `;

  const endpoint = process.env.ZORA_GRAPH_URL ?? 'https://api.zora.co/graphql';
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { contract: contractAddress, fromBlock } }),
    signal: AbortSignal.timeout(8000),
  });

  if (!resp.ok) throw new Error(`Zora API error: ${resp.status}`);

  const json = await resp.json() as { data?: { transferEvents?: ZoraTransferEvent[] } };
  const events = json.data?.transferEvents ?? [];
  const latestBlock = events.length > 0
    ? Math.max(...events.map(e => e.blockNumber))
    : fromBlock;

  return { events, latestBlock };
}

export async function GET(request: Request) {
  // Vercel automatically adds Authorization: Bearer <CRON_SECRET> for cron routes
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const synced: string[] = [];
  const errors: { id: string; error: string }[] = [];

  try {
    const { data: collections, error: fetchErr } = await supabase
      .from('nft_collections')
      .select('id, contract_address, sync_cursor, owner_id')
      .eq('status', 'live')
      .not('contract_address', 'is', null);

    if (fetchErr) throw fetchErr;
    if (!collections || collections.length === 0) {
      return NextResponse.json({ synced: 0, errors: 0 });
    }

    for (const collection of collections) {
      try {
        const fromBlock = collection.sync_cursor ?? 0;
        const { events, latestBlock } = await fetchZoraTransfers(
          collection.contract_address!,
          fromBlock
        );

        for (const event of events) {
          // Update or insert token row
          const { data: existingToken } = await supabase
            .from('nft_tokens')
            .select('id, soulbound')
            .eq('collection_id', collection.id)
            .eq('token_id', parseInt(event.tokenId, 10))
            .maybeSingle();

          if (existingToken) {
            // Skip holder update for soulbound tokens
            if (!existingToken.soulbound) {
              await supabase
                .from('nft_tokens')
                .update({
                  holder_address: event.toAddress.toLowerCase(),
                  tx_hash: event.txHash,
                })
                .eq('id', existingToken.id);
            }
          } else {
            await supabase
              .from('nft_tokens')
              .insert({
                collection_id: collection.id,
                token_id: parseInt(event.tokenId, 10),
                holder_address: event.toAddress.toLowerCase(),
                tx_hash: event.txHash,
                minted_at: new Date().toISOString(),
              });
          }

          // Sync owns_nft_of graph edge for linked profiles
          const { data: holderProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('wallet_address', event.toAddress.toLowerCase())
            .maybeSingle();

          if (holderProfile) {
            const { data: holderNode } = await supabase
              .from('mythic_nodes')
              .select('id')
              .eq('node_type', 'artist_profile')
              .eq('source_table', 'profiles')
              .eq('source_id', holderProfile.id)
              .maybeSingle();

            const { data: nftNode } = await supabase
              .from('mythic_nodes')
              .select('id')
              .eq('node_type', 'nft_collection')
              .eq('source_table', 'nft_collections')
              .eq('source_id', collection.id)
              .maybeSingle();

            if (holderNode && nftNode) {
              // Upsert owns_nft_of edge (idempotent)
              await supabase
                .from('mythic_edges')
                .upsert(
                  {
                    from_node_id: holderNode.id,
                    to_node_id: nftNode.id,
                    edge_type: 'owns_nft_of',
                    metadata: { token_id: event.tokenId, tx_hash: event.txHash },
                    source_event: 'cron:nft-sync',
                  },
                  { onConflict: 'from_node_id,to_node_id,edge_type' }
                );
            }
          }
        }

        // Advance sync cursor
        await supabase
          .from('nft_collections')
          .update({ sync_cursor: latestBlock })
          .eq('id', collection.id);

        synced.push(collection.id);
      } catch (err) {
        errors.push({
          id: collection.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      synced: synced.length,
      errors: errors.length,
      ...(errors.length > 0 && { error_details: errors }),
    });
  } catch (error) {
    return handleApiError(error, 'cron:nft-sync');
  }
}
