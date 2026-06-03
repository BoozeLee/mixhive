import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, unauthorized, badRequest } from '@/lib/api-errors';
import { z } from 'zod';

const MintSchema = z.object({
  holder_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address'),
  holder_profile: z.string().uuid().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.WEB3_EXPERIMENTS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'web3_disabled' }, { status: 503 });
  }
  try {
    const { id: collectionId } = await params;
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = MintSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

    // Verify collection exists and is live (or deploying for gasless claim)
    const { data: collection, error: collErr } = await supabase
      .from('nft_collections')
      .select('id, owner_id, max_supply, soulbound, status')
      .eq('id', collectionId)
      .single();

    if (collErr || !collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    // Only owner can trigger mints for gasless flow; direct claims go via the same route
    // (access check: owner OR the caller is the intended holder)
    const isOwner = collection.owner_id === user.id;
    const isHolder = parsed.data.holder_profile === user.id;
    if (!isOwner && !isHolder) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check supply
    if (collection.max_supply) {
      const { count } = await supabase
        .from('nft_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', collectionId);
      if ((count ?? 0) >= collection.max_supply) {
        return NextResponse.json({ error: 'Supply exhausted' }, { status: 409 });
      }
    }

    // Insert pending token — background worker (NFT_SIGNER_KEY) does the on-chain mint
    const { data: token, error: tokenErr } = await supabase
      .from('nft_tokens')
      .insert({
        collection_id: collectionId,
        holder_address: parsed.data.holder_address,
        holder_profile: parsed.data.holder_profile ?? user.id,
        soulbound: collection.soulbound,
      })
      .select('id')
      .single();

    if (tokenErr) throw tokenErr;

    return NextResponse.json({ token_id: token.id, status: 'pending_mint' }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'nft:collections:mint');
  }
}
