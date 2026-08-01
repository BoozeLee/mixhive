// Daily notary: builds one Merkle root over every genome sealed yesterday and
// writes each spore its inclusion proof.
//
// Off-chain by default and fully useful that way — a published root plus a proof
// is verifiable by anyone with no chain access. On-chain anchoring is a separate,
// opt-in step (FK-3, Base Sepolia; mainnet gated to P14).
//
// Deliberately NOT registered in vercel.json: that account is on the Hobby plan
// where crons may run at most once per day, and the schedule budget is already
// spoken for. This is safe to call manually or from any external scheduler, and
// nothing degrades if it is never called — spores stay sealed and verifiable via
// their Ed25519 seal alone.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildMerkleBatch } from '@/lib/flow-key/merkle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Default to yesterday so the day is closed and cannot gain more spores.
  const requested = new URL(req.url).searchParams.get('date');
  const batchDate = requested ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const { data: pending, error } = await sb.rpc('flow_spores_awaiting_anchor', {
    p_batch_date: batchDate,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (pending ?? []) as Array<{ id: string; content_hash: string }>;
  if (rows.length === 0) {
    return NextResponse.json({ batch_date: batchDate, anchored: 0, root: null });
  }

  const batch = buildMerkleBatch(rows.map(r => r.content_hash));

  const { data: anchorId, error: recordError } = await sb.rpc('record_flow_spore_anchor', {
    p_batch_date: batchDate,
    p_merkle_root: batch.root,
    p_leaf_count: batch.leafCount,
    p_proofs: rows.map((r, i) => ({ spore_id: r.id, proof: batch.proofs[i] })),
  });
  if (recordError) return NextResponse.json({ error: recordError.message }, { status: 500 });

  return NextResponse.json({
    batch_date: batchDate,
    anchored: rows.length,
    root: batch.root,
    anchor_id: anchorId,
    // On-chain anchoring is opt-in and separate; the root is already useful.
    chain: null,
  });
}
