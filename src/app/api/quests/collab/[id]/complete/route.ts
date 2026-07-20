// Complete a collab quest, awarding XP and reputation to all participants.
// RPG mechanics: XP reward is distributed, reputation is boosted.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError, forbidden, notFound } from '@/lib/api-errors';

function makeClient(jwt?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    auth: { persistSession: false },
  });
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);
    const sb = makeClient(jwt);
    const svc = makeClient(); // Service role for updates

    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { data: quest } = await svc
      .from('collab_quests')
      .select('id, creator_profile_id, phase, xp_reward, title')
      .eq('id', id)
      .single();

    if (!quest) return notFound('Quest not found');
    if (quest.creator_profile_id !== user.id)
      return forbidden('Only the quest creator can mark it complete');
    if (quest.phase === 'complete')
      return NextResponse.json({ error: 'Quest already complete' }, { status: 400 });

    // 1. Mark quest complete
    await svc
      .from('collab_quests')
      .update({
        phase: 'complete',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // 2. Find all participants (filled roles)
    const { data: roles } = await svc
      .from('collab_roles')
      .select('filled_by_profile_id')
      .eq('quest_id', id)
      .eq('status', 'filled');

    const participantIds = Array.from(
      new Set([
        quest.creator_profile_id,
        ...(roles?.map(r => r.filled_by_profile_id).filter(Boolean) as string[]),
      ])
    );

    // 3. Award XP and reputation (RPG mechanics)
    for (const pid of participantIds) {
      // Fetch current stats
      const { data: profile } = await svc
        .from('profiles')
        .select('xp, level, reputation_score')
        .eq('id', pid)
        .single();

      if (!profile) continue;

      const newXp = (profile.xp || 0) + quest.xp_reward;
      const newRep = (profile.reputation_score || 0) + 10; // +10 rep for successful collab
      // Simple leveling logic: level = floor(sqrt(xp / 100)) + 1
      const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

      await svc
        .from('profiles')
        .update({
          xp: newXp,
          level: newLevel,
          reputation_score: newRep,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pid);

      // 4. Notify participants
      await svc.from('notifications').insert({
        user_id: pid,
        type: 'quest_complete',
        body: `Quest "${quest.title}" is complete! You earned ${quest.xp_reward} XP.`,
        metadata: {
          quest_id: id,
          xp_earned: quest.xp_reward,
          level_up: newLevel > (profile.level || 1),
        },
        read: false,
      });
    }

    return NextResponse.json({
      ok: true,
      phase: 'complete',
      participants_rewarded: participantIds.length,
    });
  } catch (err) {
    return handleApiError(err, 'quests/collab/complete');
  }
}
