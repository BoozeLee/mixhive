import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { ritualAuth } from '../../../_lib';

/**
 * Host-only cap override — the sole way the take playing right now becomes
 * eligible to drain. Everything else about the Flow Key refuses to harvest
 * unfinished work; this is the one deliberate exception, so it is gated to the
 * host and refused while a drain is open.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { asset_id, capped } = (await req.json().catch(() => ({}))) as {
      asset_id?: string;
      capped?: boolean;
    };
    if (!asset_id) {
      return NextResponse.json({ error: 'asset_id is required' }, { status: 400 });
    }

    const { data, error } = await ctx.sb.rpc('cap_flow_key_cell', {
      p_session_id: id,
      p_asset_id: asset_id,
      p_capped: capped ?? true,
    });

    if (error) {
      if (error.message.includes('Only creators')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (error.message.includes('drain is open')) {
        return NextResponse.json({ error: 'drain_already_open' }, { status: 409 });
      }
      if (error.message.includes('Asset not found')) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'flow-key:cap');
  }
}
