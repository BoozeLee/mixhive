import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { ritualAuth } from '@/app/api/mythic/sessions/_lib';

/**
 * Spores the caller can see. RLS already restricts flow_spores to the turner
 * and its contributors, so this needs no ownership filter of its own — asking
 * for everything returns exactly what you are entitled to.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 30) || 30, 100);

    const { data: spores, error } = await ctx.sb
      .from('flow_spores')
      .select(
        'id, session_id, turned_by, state, sealed_at, created_at, generation, parent_hash, content_hash, capped_count, skipped_count, carbon, silica'
      )
      .eq('state', 'sealed')
      .order('sealed_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const ids = (spores ?? []).map(s => s.id as string);

    // Contributor and germination counts, fetched in bulk rather than per card.
    const [{ data: contributors }, { data: germinations }] = await Promise.all([
      ids.length
        ? ctx.sb.from('flow_spore_contributors').select('spore_id, fraction').in('spore_id', ids)
        : Promise.resolve({ data: [] as Array<{ spore_id: string; fraction: string }> }),
      ids.length
        ? ctx.sb.from('flow_spore_germinations').select('spore_id').in('spore_id', ids)
        : Promise.resolve({ data: [] as Array<{ spore_id: string }> }),
    ]);

    const carbonBy = new Map<string, number>();
    const silicaBy = new Map<string, number>();
    for (const c of (contributors ?? []) as Array<{ spore_id: string; fraction: string }>) {
      const m = c.fraction === 'silica' ? silicaBy : carbonBy;
      m.set(c.spore_id, (m.get(c.spore_id) ?? 0) + 1);
    }

    const germBy = new Map<string, number>();
    for (const g of (germinations ?? []) as Array<{ spore_id: string }>) {
      germBy.set(g.spore_id, (germBy.get(g.spore_id) ?? 0) + 1);
    }

    return NextResponse.json({
      spores: (spores ?? []).map(s => ({
        id: s.id,
        session_id: s.session_id,
        state: s.state,
        sealed_at: s.sealed_at,
        generation: s.generation,
        content_hash: s.content_hash,
        parent_hash: s.parent_hash,
        capped_count: s.capped_count,
        skipped_count: s.skipped_count,
        carbon_count: carbonBy.get(s.id as string) ?? 0,
        silica_count: silicaBy.get(s.id as string) ?? 0,
        germination_count: germBy.get(s.id as string) ?? 0,
        is_mine: s.turned_by === ctx.user.id,
      })),
    });
  } catch (error) {
    return handleApiError(error, 'flow-spores:list');
  }
}
