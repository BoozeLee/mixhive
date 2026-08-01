import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';
import { assembleSpore, type SporeAsset } from '@/lib/flow-key/spore';
import { loadSealKey } from '@/lib/flow-key/seal';
import { ritualAuth } from '../../../_lib';

/** The bounded ritual agent seeded by migration 119. */
const RITUAL_AGENT_SLUG = 'session-spirit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { spore_id } = (await req.json().catch(() => ({}))) as { spore_id?: string };
    if (!spore_id) return NextResponse.json({ error: 'spore_id required' }, { status: 400 });

    const sb = createServerClient();

    const { data: spore } = await sb
      .from('flow_spores')
      .select('id, session_id, state, opened_at, generation, parent_hash, turned_by')
      .eq('id', spore_id)
      .eq('session_id', id)
      .eq('state', 'draining')
      .maybeSingle();

    if (!spore) {
      return NextResponse.json({ error: 'Spore not found or not draining' }, { status: 404 });
    }

    const [{ data: assetRows }, { data: state }, { data: eventRows }] = await Promise.all([
      sb
        .from('collab_session_assets')
        .select(
          'id, name, created_at, upload_complete, deleted_at, uploader_id, duration_seconds, metadata'
        )
        .eq('session_id', id),
      sb
        .from('collab_session_state')
        .select('current_asset_id, playback_status')
        .eq('session_id', id)
        .maybeSingle(),
      sb
        .from('collab_session_events')
        .select('id, event_type, actor_id, actor_type, created_at, payload')
        .eq('session_id', id),
    ]);

    const events = (
      (eventRows ?? []) as Array<{
        id: string;
        event_type: string;
        actor_id: string | null;
        actor_type: string;
        created_at: string;
        payload: { asset_id?: string } | null;
      }>
    ).filter(e => new Date(e.created_at) <= new Date(spore.opened_at as string));

    const assets: SporeAsset[] = ((assetRows ?? []) as Array<Record<string, unknown>>).map(row => ({
      id: row.id as string,
      name: row.name as string,
      created_at: row.created_at as string,
      upload_complete: (row.upload_complete as boolean | null) ?? true,
      deleted_at: (row.deleted_at as string | null) ?? null,
      uploader_id: row.uploader_id as string,
      duration_seconds: (row.duration_seconds as number | null) ?? null,
      // Digest is written by the audio worker into asset metadata. Audio itself
      // never enters the genome — only this content digest.
      digest: String((row.metadata as { digest?: string } | null)?.digest ?? ''),
    }));

    // The silica fraction comes from the ritual agent's bounded actions on this
    // session. mix_agent_credits is keyed by mix_id and has no session_id, so it
    // is the wrong source for a live room.
    const agentActions = events.filter(e => e.actor_type === 'agent').length;

    const sealKey = loadSealKey();

    const doc = assembleSpore({
      sporeId: spore.id as string,
      sessionId: id,
      boundary: spore.opened_at as string,
      generation: (spore.generation as number) ?? 0,
      parentHash: (spore.parent_hash as string | null) ?? null,
      assets,
      currentAssetId: (state?.current_asset_id as string | null) ?? null,
      playbackStatus: (state?.playback_status as 'paused' | 'playing') ?? 'paused',
      manuallyCappedIds: events
        .filter(e => e.event_type === 'flow_key_cap')
        .map(e => e.payload?.asset_id)
        .filter((v): v is string => Boolean(v)),
      marks: events
        .filter(e => ['mark', 'vote', 'chat-message'].includes(e.event_type))
        .map(e => ({
          id: e.id,
          event_type: e.event_type,
          actor_id: e.actor_id,
          created_at: e.created_at,
        })),
      agentCredits:
        agentActions > 0 ? [{ agent_slug: RITUAL_AGENT_SLUG, actions: agentActions }] : [],
      detected: { musical_key: null, bpm: null },
      hostProfileId: spore.turned_by as string,
      sealKey: { privateKeyPem: sealKey.privateKeyPem, keyId: sealKey.keyId },
    });

    const storagePath = `${id}/${doc.genome.spore_id}.json`;
    const { error: uploadError } = await sb.storage
      .from('flow-spores')
      .upload(storagePath, Buffer.from(JSON.stringify(doc), 'utf8'), {
        contentType: 'application/json',
        upsert: true,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { error: sealError } = await sb.rpc('seal_flow_spore', {
      p_spore_id: spore.id,
      p_carbon: doc.genome.carbon,
      p_silica: doc.genome.silica,
      p_content_hash: doc.content_hash,
      p_signature: doc.seal.signature,
      p_key_id: doc.seal.key_id,
      p_storage_path: storagePath,
      p_capped: doc.capped_count,
      p_skipped: doc.skipped_count,
      p_contributors: doc.contributors,
    });
    if (sealError) return NextResponse.json({ error: sealError.message }, { status: 400 });

    return NextResponse.json({
      spore_id: spore.id,
      content_hash: doc.content_hash,
      capped: doc.capped_count,
      skipped: doc.skipped_count,
      seal: { key_id: doc.seal.key_id, algorithm: doc.seal.algorithm },
    });
  } catch (error) {
    return handleApiError(error, 'flow-key:seal');
  }
}
