import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { ritualAuth } from '@/app/api/mythic/sessions/_lib';

const TARGETS = ['beehive', 'mixhive_session', 'mix_draft'] as const;
type Target = (typeof TARGETS)[number];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const body = (await req.json().catch(() => ({}))) as {
      target?: string;
      child_id?: string | null;
    };

    if (!body.target || !TARGETS.includes(body.target as Target)) {
      return NextResponse.json(
        { error: `target must be one of: ${TARGETS.join(', ')}` },
        { status: 400 }
      );
    }

    const { data, error } = await ctx.sb.rpc('germinate_flow_spore', {
      p_spore_id: id,
      p_target: body.target,
      p_child_id: body.child_id ?? null,
    });

    if (error) {
      if (error.message.includes('Not authorized')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (error.message.includes('not sealed')) {
        return NextResponse.json({ error: 'Spore is not sealed' }, { status: 409 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Spore not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const result = data as {
      germination_id: string;
      edge_id: string | null;
      generation: number;
      parent_hash: string | null;
    };

    return NextResponse.json(
      {
        germination_id: result.germination_id,
        edge_id: result.edge_id,
        generation: result.generation,
        parent_hash: result.parent_hash,
        // A spore germinated toward Beehive still needs a one-shot download
        // grant to actually carry the payload across.
        next: body.target === 'beehive' ? `/api/flow-spores/${id}/grant` : null,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'flow-spore:germinate');
  }
}
