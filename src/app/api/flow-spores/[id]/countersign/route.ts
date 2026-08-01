import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';
import { countersignMessage, verifyCountersignature } from '@/lib/flow-key/countersign';
import { ritualAuth } from '@/app/api/mythic/sessions/_lib';

/**
 * GET — the exact text to sign. A wallet displays this verbatim, so the client
 * must never compose it itself; both sides derive it from the same function.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const address = new URL(req.url).searchParams.get('address');
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return NextResponse.json({ error: 'A valid address is required' }, { status: 400 });
    }

    const { data: spore } = await ctx.sb
      .from('flow_spores')
      .select('id, session_id, content_hash, state')
      .eq('id', id)
      .maybeSingle();

    if (!spore) return NextResponse.json({ error: 'Spore not found' }, { status: 404 });
    if (spore.state !== 'sealed' || !spore.content_hash) {
      return NextResponse.json({ error: 'Spore is not sealed' }, { status: 409 });
    }

    return NextResponse.json({
      message: countersignMessage({
        sporeId: spore.id as string,
        contentHash: spore.content_hash as string,
        sessionId: spore.session_id as string,
        address,
      }),
    });
  } catch (error) {
    return handleApiError(error, 'flow-spore:countersign-message');
  }
}

/** POST — verify a personal_sign over that message and record it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { address, signature } = (await req.json().catch(() => ({}))) as {
      address?: string;
      signature?: string;
    };
    if (!address || !signature) {
      return NextResponse.json({ error: 'address and signature are required' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    const { data: spore } = await ctx.sb
      .from('flow_spores')
      .select('id, session_id, content_hash, state')
      .eq('id', id)
      .maybeSingle();

    if (!spore) return NextResponse.json({ error: 'Spore not found' }, { status: 404 });
    if (spore.state !== 'sealed' || !spore.content_hash) {
      return NextResponse.json({ error: 'Spore is not sealed' }, { status: 409 });
    }

    const valid = verifyCountersignature(
      {
        sporeId: spore.id as string,
        contentHash: spore.content_hash as string,
        sessionId: spore.session_id as string,
        address,
      },
      signature
    );

    if (!valid) {
      return NextResponse.json({ error: 'Signature does not match address' }, { status: 400 });
    }

    // Verified above; the RPC only records. Service role because the write must
    // not be reachable from a client that could skip verification.
    const sb = createServerClient();
    const { error } = await sb.rpc('record_flow_spore_countersignature', {
      p_spore_id: id,
      p_profile_id: ctx.user.id,
      p_address: address,
      p_signature: signature,
    });

    if (error) {
      if (error.message.includes('Not a carbon contributor')) {
        return NextResponse.json(
          { error: 'Only contributors to this spore can countersign it' },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ countersigned: true, address: address.toLowerCase() });
  } catch (error) {
    return handleApiError(error, 'flow-spore:countersign');
  }
}
