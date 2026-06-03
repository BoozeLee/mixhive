// Advance a collab quest through its phase lifecycle.
// Only the creator can move phases; valid transitions are enforced.
// On complete: triggers XP awards to all filled role holders.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:       ['recruiting', 'cancelled'],
  recruiting:  ['in_progress', 'cancelled'],
  in_progress: ['complete', 'cancelled'],
};

// XP multipliers
const ROLE_XP_BASE = 1.0;
const EARLY_BONUS  = 0.20;
const LATE_PENALTY = 0.15;

function makeClient(jwt: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const sb = makeClient(authHeader.slice(7));

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { to_phase } = await req.json();
    if (!to_phase) return NextResponse.json({ error: 'to_phase required' }, { status: 400 });

    // Load quest
    const { data: quest, error: questErr } = await sb
      .from('collab_quests')
      .select('*, collab_roles(*)')
      .eq('id', id)
      .single();
    if (questErr || !quest) return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    if (quest.creator_profile_id !== user.id) {
      return NextResponse.json({ error: 'Only the quest creator can advance phase' }, { status: 403 });
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[quest.phase] ?? [];
    if (!allowed.includes(to_phase)) {
      return NextResponse.json(
        { error: `Cannot transition from '${quest.phase}' to '${to_phase}'` },
        { status: 422 }
      );
    }

    // Build update payload
    const update: Record<string, unknown> = { phase: to_phase };
    if (to_phase === 'complete') {
      update.completed_at = new Date().toISOString();
    }

    const { data: updatedQuest, error: updateErr } = await sb
      .from('collab_quests')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    // On complete: award XP to all filled role holders
    if (to_phase === 'complete') {
      const filledRoles = (quest.collab_roles ?? []).filter(
        (r: { status: string; filled_by_profile_id: string | null }) =>
          r.status === 'filled' && r.filled_by_profile_id
      );

      const deadline = quest.deadline ? new Date(quest.deadline) : null;
      const completedAt = new Date();
      const isEarly = deadline && completedAt <= deadline;
      const isLate = quest.timeline_days && quest.created_at
        ? completedAt >
          new Date(new Date(quest.created_at).getTime() + (quest.timeline_days + 7) * 86400000)
        : false;

      let multiplier = ROLE_XP_BASE;
      if (isEarly) multiplier += EARLY_BONUS;
      if (isLate) multiplier -= LATE_PENALTY;

      const baseXp = quest.xp_reward ?? 100;
      const xpAwarded = Math.max(Math.round(baseXp * multiplier), 10);

      // Insert XP records (self-review placeholder — real reviews come from peer rating)
      const xpRows = filledRoles.map((r: { filled_by_profile_id: string; role_type: string }) => ({
        quest_id: id,
        reviewer_profile_id: quest.creator_profile_id,
        reviewee_profile_id: r.filled_by_profile_id,
        role_type: r.role_type,
        xp_awarded: xpAwarded,
      }));

      if (xpRows.length > 0) {
        await sb.from('collab_quest_reviews').insert(xpRows);
      }
    }

    return NextResponse.json({ quest: updatedQuest, transitioned_to: to_phase });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
