import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sb = createServerClient();
    const days = 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data: profiles } = await sb.from('profiles').select('id, display_name, email');

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ ok: true, recaps: 0 });
    }

    const recaps: Array<{
      profileId: string;
      displayName: string;
      plays: number;
      likes: number;
      comments: number;
      newMixes: number;
      followersGained: number;
    }> = [];

    for (const profile of profiles) {
      const [mixesResult, dailyResult, followersBefore] = await Promise.all([
        sb
          .from('mixes')
          .select('id, play_count, like_count, comment_count, created_at')
          .eq('dj_id', profile.id)
          .gte('created_at', since),
        sb
          .from('profile_analytics_daily')
          .select('plays, likes, comments, follows')
          .eq('profile_id', profile.id)
          .gte('day', since),
        sb
          .from('profile_analytics_daily')
          .select('follows')
          .eq('profile_id', profile.id)
          .lt('day', since)
          .order('day', { ascending: false })
          .limit(30),
      ]);

      const mixes = mixesResult.data || [];
      const daily = dailyResult.data || [];
      const prev = followersBefore.data || [];

      const totalPlays = daily.reduce((s, r) => s + (r.plays || 0), 0);
      const totalLikes = daily.reduce((s, r) => s + (r.likes || 0), 0);
      const totalComments = daily.reduce((s, r) => s + (r.comments || 0), 0);
      const newMixes = mixes.length;
      const followersGained = daily.reduce((s, r) => s + (r.follows || 0), 0);
      const prevFollowers = prev.reduce((s, r) => s + (r.follows || 0), 0);

      if (totalPlays > 0 || newMixes > 0 || followersGained > 0) {
        recaps.push({
          profileId: profile.id,
          displayName: profile.display_name || 'Artist',
          plays: totalPlays,
          likes: totalLikes,
          comments: totalComments,
          newMixes,
          followersGained,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      recaps: recaps.length,
      recapData: recaps,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
