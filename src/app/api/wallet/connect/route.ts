import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage, JsonRpcProvider } from 'ethers';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, unauthorized } from '@/lib/api-errors';

// SIWE (Sign-In With Ethereum) wallet linkage.
// POST  — verifies a SIWE message+signature and stores wallet_address on the profile.
// DELETE — clears wallet_address and soft-deletes owns_nft_of graph edges.
//
// We do manual SIWE parsing to avoid adding a heavy dependency that would require
// a paid build step. The message format is EIP-4361 compliant.

function parseSiweMessage(message: string): { address?: string; nonce?: string; expirationTime?: string } {
  const addressMatch = message.match(/^(0x[0-9a-fA-F]{40})/m);
  const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/i);
  const expMatch = message.match(/Expiration Time: (.+)/i);
  return {
    address: addressMatch?.[1],
    nonce: nonceMatch?.[1],
    expirationTime: expMatch?.[1]?.trim(),
  };
}

function verifySignature(message: string, signature: string, expectedAddress: string): boolean {
  try {
    const recovered = verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, signature } = await request.json() as { message: string; signature: string };

    if (!message || !signature) {
      return NextResponse.json({ error: 'message and signature are required' }, { status: 400 });
    }

    const { address, nonce, expirationTime } = parseSiweMessage(message);

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address in message' }, { status: 400 });
    }

    // Check expiry
    if (expirationTime && new Date(expirationTime) < new Date()) {
      return NextResponse.json({ error: 'SIWE message has expired' }, { status: 400 });
    }

    // Verify the signature
    const valid = verifySignature(message, signature, address);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Consume nonce — soft-fail if table not yet created
    const supabase = createServerClient();
    if (nonce) {
      const { error: nonceErr } = await supabase
        .from('siwe_nonces')
        .delete()
        .eq('nonce', nonce)
        .gt('expires_at', new Date().toISOString());
      if (nonceErr) {
        console.warn('[wallet:connect] nonce consume failed (table may not exist):', nonceErr.message);
      }
    }

    // Require auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const normalised = address.toLowerCase();

    // Store wallet_address — unique index prevents two profiles claiming same address
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ wallet_address: normalised })
      .eq('id', user.id);

    if (updateErr) {
      if (updateErr.code === '23505') {
        return NextResponse.json({ error: 'This wallet is already linked to another account' }, { status: 409 });
      }
      throw updateErr;
    }

    // Record in wallet_links for multi-wallet support (soft-fail: table may not exist yet)
    await supabase.from('wallet_links').upsert(
      { profile_id: user.id, wallet_address: normalised, chain: 'base', wallet_type: 'external' },
      { onConflict: 'profile_id,wallet_address,chain', ignoreDuplicates: true }
    ).then(({ error: wlErr }) => {
      if (wlErr) console.warn('[wallet:connect] wallet_links upsert failed:', wlErr.message);
    });

    // Advance web3_tier to at least 1 (wallet connected, can verify NFTs)
    await supabase
      .from('profiles')
      .update({ web3_tier: 1 })
      .eq('id', user.id)
      .lt('web3_tier', 1);

    // ENS resolution is a best-effort enhancement — never block the response on it
    let ensName: string | null = null;
    try {
      const provider = new JsonRpcProvider('https://cloudflare-eth.com');
      ensName = await provider.lookupAddress(normalised);
    } catch {
      // ignore
    }

    return NextResponse.json({ wallet_address: normalised, ens_name: ensName });
  } catch (error) {
    return handleApiError(error, 'wallet:connect:post');
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const { data: profile } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single();

    if (!profile?.wallet_address) {
      return NextResponse.json({ error: 'No wallet connected' }, { status: 400 });
    }

    // Soft-delete owns_nft_of graph edges (keeps nft_tokens.holder_address for provenance)
    const { data: artistNode } = await supabase
      .from('mythic_nodes')
      .select('id')
      .eq('node_type', 'artist_profile')
      .eq('source_table', 'profiles')
      .eq('source_id', user.id)
      .maybeSingle();

    if (artistNode) {
      await supabase
        .from('mythic_edges')
        .delete()
        .eq('from_node_id', artistNode.id)
        .eq('edge_type', 'owns_nft_of');
    }

    await supabase
      .from('profiles')
      .update({ wallet_address: null, web3_tier: 0 })
      .eq('id', user.id);

    // Remove from wallet_links
    if (profile.wallet_address) {
      await supabase
        .from('wallet_links')
        .delete()
        .eq('profile_id', user.id)
        .eq('wallet_address', profile.wallet_address);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'wallet:connect:delete');
  }
}
