import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { ritualAuth } from '@/app/api/mythic/sessions/_lib';

interface ContributorRow {
  spore_id: string;
  fraction: string;
  profile_id: string | null;
  countersignature: string | null;
}

interface AnchorRow {
  id: string;
  batch_date: string;
  merkle_root: string;
  anchored_at: string | null;
  chain: string | null;
}

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
        'id, session_id, turned_by, state, sealed_at, created_at, generation, parent_hash, content_hash, capped_count, skipped_count, carbon, silica, anchor_id'
      )
      .eq('state', 'sealed')
      .order('sealed_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const ids = (spores ?? []).map(s => s.id as string);
    const anchorIds = [
      ...new Set((spores ?? []).map(s => s.anchor_id).filter((a): a is string => Boolean(a))),
    ];

    // Contributor, germination and anchor lookups in bulk rather than per card.
    const [{ data: contributors }, { data: germinations }, { data: anchors }] = await Promise.all([
      ids.length
        ? ctx.sb
            .from('flow_spore_contributors')
            .select('spore_id, fraction, profile_id, countersignature')
            .in('spore_id', ids)
        : Promise.resolve({ data: [] as ContributorRow[] }),
      ids.length
        ? ctx.sb.from('flow_spore_germinations').select('spore_id').in('spore_id', ids)
        : Promise.resolve({ data: [] as Array<{ spore_id: string }> }),
      anchorIds.length
        ? ctx.sb
            .from('flow_spore_anchors')
            .select('id, batch_date, merkle_root, anchored_at, chain')
            .in('id', anchorIds)
        : Promise.resolve({ data: [] as AnchorRow[] }),
    ]);

    const carbonBy = new Map<string, number>();
    const silicaBy = new Map<string, number>();
    const signedBy = new Map<string, number>();
    // Whether *this* caller is an as-yet-unsigned carbon contributor.
    const canSign = new Map<string, boolean>();
    const didSign = new Map<string, boolean>();

    for (const c of (contributors ?? []) as ContributorRow[]) {
      const m = c.fraction === 'silica' ? silicaBy : carbonBy;
      m.set(c.spore_id, (m.get(c.spore_id) ?? 0) + 1);
      if (c.countersignature) {
        signedBy.set(c.spore_id, (signedBy.get(c.spore_id) ?? 0) + 1);
      }
      if (c.fraction === 'carbon' && c.profile_id === ctx.user.id) {
        canSign.set(c.spore_id, !c.countersignature);
        didSign.set(c.spore_id, Boolean(c.countersignature));
      }
    }

    const anchorById = new Map<string, AnchorRow>();
    for (const a of (anchors ?? []) as AnchorRow[]) anchorById.set(a.id, a);

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
        countersigned_count: signedBy.get(s.id as string) ?? 0,
        can_countersign: canSign.get(s.id as string) ?? false,
        i_countersigned: didSign.get(s.id as string) ?? false,
        anchor: s.anchor_id
          ? (() => {
              const a = anchorById.get(s.anchor_id as string);
              return a
                ? {
                    batch_date: a.batch_date,
                    merkle_root: a.merkle_root,
                    // Off-chain roots are still real notarisation; `chain` only
                    // says whether one was additionally written on chain.
                    chain: a.chain,
                    anchored_at: a.anchored_at,
                  }
                : null;
            })()
          : null,
        is_mine: s.turned_by === ctx.user.id,
      })),
    });
  } catch (error) {
    return handleApiError(error, 'flow-spores:list');
  }
}
