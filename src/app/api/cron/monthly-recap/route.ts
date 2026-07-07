import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { MonthlyRecapEmail } from '@/components/emails/MonthlyRecapEmail';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (authHeader !== `Bearer ${cronSecret}`) {
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
    let sent = 0;
    let skipped = 0;

    for (const profile of profiles) {
      const [mixesResult, dailyResult] = await Promise.all([
        sb
          .from('mixes')
          .select('id, play_count, like_count, comment_count, created_at')
          .eq('dj_id', profile.id)
          .gte('created_at', since),
        sb
          .from('profile_analytics_daily')
          .select('plays, likes, comments, follows')
          .eq('profile_id', profile.id)
          .gte('day', since.slice(0, 10)),
      ]);

      const mixes = mixesResult.data || [];
      const daily = dailyResult.data || [];

      const totalPlays = daily.reduce((s, r) => s + (r.plays || 0), 0);
      const totalLikes = daily.reduce((s, r) => s + (r.likes || 0), 0);
      const totalComments = daily.reduce((s, r) => s + (r.comments || 0), 0);
      const newMixes = mixes.length;
      const followersGained = daily.reduce((s, r) => s + (r.follows || 0), 0);

      if (totalPlays === 0 && newMixes === 0 && followersGained === 0) {
        skipped++;
        continue;
      }

      const recap = {
        profileId: profile.id,
        displayName: profile.display_name || 'Artist',
        plays: totalPlays,
        likes: totalLikes,
        comments: totalComments,
        newMixes,
        followersGained,
      };
      recaps.push(recap);

      if (profile.email && isEmailConfigured()) {
        await sendEmail({
          to: profile.email,
          subject: 'Your MixHive month in review',
          react: React.createElement(MonthlyRecapEmail, {
            displayName: recap.displayName,
            plays: recap.plays,
            likes: recap.likes,
            comments: recap.comments,
            newMixes: recap.newMixes,
            followersGained: recap.followersGained,
          }),
          text: `Hi ${recap.displayName}, this month you had ${recap.plays} plays, ${recap.likes} likes, ${recap.comments} comments, ${recap.newMixes} new mixes, and ${recap.followersGained} new followers.`,
        });
        sent++;
      }
    }

    return NextResponse.json({
      ok: true,
      recaps: recaps.length,
      sent,
      skipped,
      recapData: recaps,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
