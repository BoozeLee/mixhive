import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleApiError } from '@/lib/api-errors';
import { selectCappedCells, type CappableAsset } from '@/lib/flow-key/capping';
import { ritualAuth } from '../../_lib';

async function cappedCounts(sb: SupabaseClient, sessionId: string, boundary: string) {
  const [{ data: assets }, { data: state }, { data: capEvents }] = await Promise.all([
    sb
      .from('collab_session_assets')
      .select('id, name, created_at, upload_complete, deleted_at')
      .eq('session_id', sessionId),
    sb
      .from('collab_session_state')
      .select('current_asset_id, playback_status')
      .eq('session_id', sessionId)
      .maybeSingle(),
    sb
      .from('collab_session_events')
      .select('payload')
      .eq('session_id', sessionId)
      .eq('event_type', 'flow_key_cap'),
  ]);

  const manuallyCappedIds = ((capEvents ?? []) as Array<{ payload?: { asset_id?: string } }>)
    .map(e => e.payload?.asset_id)
    .filter((id): id is string => Boolean(id));

  const currentAssetId = (state?.current_asset_id as string | null) ?? null;
  const playbackStatus = (state?.playback_status as 'paused' | 'playing') ?? 'paused';
  const rows = (assets ?? []) as Array<CappableAsset & { name?: string }>;

  const partition = selectCappedCells(rows, {
    boundary,
    currentAssetId,
    playbackStatus,
    manuallyCappedIds,
  });

  // The take playing right now, when it is the reason a cell is being skipped.
  // Surfacing it is what makes the host override reachable.
  const live = rows.find(a => a.id === currentAssetId);
  const liveTake =
    live && playbackStatus === 'playing' && !manuallyCappedIds.includes(live.id)
      ? { id: live.id, name: live.name ?? 'the current take' }
      : null;

  return { ...partition, liveTake };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    // Boundary for the pre-check is now; the RPC records the authoritative
    // opened_at, and the seal re-derives counts from it.
    const { capped, skipped } = await cappedCounts(ctx.sb, id, new Date().toISOString());

    if (capped.length === 0) {
      return NextResponse.json(
        { error: 'nothing_capped', capped: 0, skipped: skipped.length },
        { status: 422 }
      );
    }

    const { data, error } = await ctx.sb.rpc('turn_flow_key', { p_session_id: id });
    if (error) {
      if (error.message.includes('drain_already_open')) {
        return NextResponse.json({ error: 'drain_already_open' }, { status: 409 });
      }
      if (error.message.includes('Not authorized')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const result = data as { spore_id: string; opened_at: string; turns_count: number };
    return NextResponse.json(
      {
        spore_id: result.spore_id,
        opened_at: result.opened_at,
        turns_count: result.turns_count,
        capped: capped.length,
        skipped: skipped.length,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'flow-key:turn');
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { data: tap } = await ctx.sb
      .from('flow_key_taps')
      .select('is_open, opened_at, turns_count, drain_lock')
      .eq('session_id', id)
      .maybeSingle();

    const boundary = (tap?.opened_at as string | null) ?? new Date().toISOString();
    const { capped, skipped, liveTake } = await cappedCounts(ctx.sb, id, boundary);

    return NextResponse.json({
      is_open: Boolean(tap?.is_open),
      opened_at: (tap?.opened_at as string | null) ?? null,
      turns_count: (tap?.turns_count as number | undefined) ?? 0,
      spore_id: (tap?.drain_lock as string | null) ?? null,
      capped: capped.length,
      skipped: skipped.length,
      live_take: liveTake,
    });
  } catch (error) {
    return handleApiError(error, 'flow-key:state');
  }
}
