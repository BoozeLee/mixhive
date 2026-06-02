import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; mid: string }> }
) {
  try {
    const { id: questId, mid: milestoneId } = await context.params;

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: quest } = await sb
      .from('quests')
      .select('id, owner_id')
      .eq('id', questId)
      .single();

    if (!quest) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }
    if (quest.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: milestone } = await sb
      .from('quest_milestones')
      .select('id, status')
      .eq('id', milestoneId)
      .eq('quest_id', questId)
      .single();

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }
    if (milestone.status === 'completed') {
      return NextResponse.json({ error: 'Milestone already completed' }, { status: 409 });
    }

    const { evidence_node_ids } = await req.json().catch(() => ({}));

    const { data: updated, error } = await sb
      .from('quest_milestones')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', milestoneId)
      .select()
      .single();

    if (error) throw error;

    if (evidence_node_ids && Array.isArray(evidence_node_ids)) {
      for (const nodeId of evidence_node_ids) {
        await sb
          .from('quest_milestone_evidence')
          .insert({
            quest_id: questId,
            milestone_id: milestoneId,
            node_id: nodeId,
          })
          .select()
          .maybeSingle();
      }
    }

    const { count: completedCount } = await sb
      .from('quest_milestones')
      .select('*', { count: 'exact', head: true })
      .eq('quest_id', questId)
      .eq('status', 'completed');

    const { data: totalCount } = await sb
      .from('quest_milestones')
      .select('id', { count: 'exact', head: true })
      .eq('quest_id', questId);

    const allDone = completedCount === totalCount;
    if (allDone) {
      await sb
        .from('quests')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', questId);
    }

    return NextResponse.json({
      milestone: updated,
      completed_count: completedCount,
      total_milestones: totalCount || 0,
      quest_completed: allDone,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
