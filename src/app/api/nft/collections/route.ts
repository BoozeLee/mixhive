import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, unauthorized, badRequest } from '@/lib/api-errors';
import { z } from 'zod';

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  max_supply: z.number().int().min(0).optional().nullable(),
  soulbound: z.boolean().optional().default(false),
  image_url: z.string().url().optional().nullable(),
  mix_id: z.string().uuid().optional().nullable(),
  quest_id: z.string().uuid().optional().nullable(),
  event_node_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  if (process.env.WEB3_EXPERIMENTS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'web3_disabled' }, { status: 503 });
  }
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const parsed = CreateCollectionSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

    const { data: collection, error } = await supabase
      .from('nft_collections')
      .insert({
        owner_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        max_supply: parsed.data.max_supply ?? null,
        soulbound: parsed.data.soulbound,
        image_url: parsed.data.image_url ?? null,
        mix_id: parsed.data.mix_id ?? null,
        quest_id: parsed.data.quest_id ?? null,
        event_node_id: parsed.data.event_node_id ?? null,
        status: 'deploying',
      })
      .select('id')
      .single();

    if (error) throw error;

    // Advance web3_tier to at least 2 — user has initiated minting
    await supabase.from('profiles').update({ web3_tier: 2 }).eq('id', user.id).lt('web3_tier', 2);

    // Background: actual on-chain deploy is handled by a background worker
    // that polls nft_collections WHERE status='deploying' and calls the Zora SDK.
    // NFT_SIGNER_KEY is a server-side-only env var — never exposed to the client.

    return NextResponse.json(
      { collection_id: collection.id, status: 'deploying' },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'nft:collections:create');
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const { data, error } = await supabase
      .from('nft_collections')
      .select('*, token_count:nft_tokens(count)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ collections: data ?? [] });
  } catch (error) {
    return handleApiError(error, 'nft:collections:list');
  }
}
