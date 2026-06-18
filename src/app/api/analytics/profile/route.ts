import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const profileId = req.nextUrl.searchParams.get('profileId') || user.id;
    const sb = createServerClient();

    const [mixesResult, followersResult, followingResult, dailyResult, gearResult] =
      await Promise.all([
        sb.from('mixes').select('id, title, play_count, like_count, comment_count, genre_name, created_at').eq('dj_id', profileId),
        sb.rpc('get_follower_count', { p_profile_id: profileId }),
        sb.rpc('get_following_count', { p_profile_id: profileId }),
        sb.from('profile_analytics_daily').select('*').eq('profile_id', profileId).order('day', { ascending: false }).limit(42),
        sb.from('equipment_transactions').select('agreed_price, platform_fee_pct, currency, transaction_state, created_at').eq('seller_profile_id', profileId),
      ]);

    const profileMixes = mixesResult.data || [];
    const followers = Number(followersResult.data ?? 0);
    const following = Number(followingResult.data ?? 0);
    const dailyRows = dailyResult.data || [];
    const gearTxns = gearResult.data || [];

    const totalPlays = profileMixes.reduce((s, m) => s + (m.play_count || 0), 0);
    const totalLikes = profileMixes.reduce((s, m) => s + (m.like_count || 0), 0);
    const totalComments = profileMixes.reduce((s, m) => s + (m.comment_count || 0), 0);

    const sortedMixes = [...profileMixes]
      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
      .slice(0, 5);

    const genreMap = new Map<string, number>();
    for (const mix of profileMixes) {
      const name = mix.genre_name || 'Uncategorized';
      genreMap.set(name, (genreMap.get(name) || 0) + 1);
    }
    const genreDistribution = Array.from(genreMap, ([name, count]) => ({ name, count }));

    const createdTimes = profileMixes
      .map(m => new Date(m.created_at).getTime())
      .filter(t => Number.isFinite(t))
      .sort((a, b) => a - b);
    const uploadFrequencyDays =
      createdTimes.length > 1
        ? Math.round((createdTimes[createdTimes.length - 1] - createdTimes[0]) / (createdTimes.length - 1) / 86400000)
        : null;

    const since = new Date(Date.now() - 42 * 86400000);
    const dayBuckets = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.now() - i * 7 * 86400000);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      dayBuckets.set(label, 0);
    }
    for (const row of dailyRows) {
      const d = new Date(row.day);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      if (dayBuckets.has(label)) {
        dayBuckets.set(label, (dayBuckets.get(label) || 0) + row.plays);
      }
    }
    const weeklyEvents = Array.from(dayBuckets, ([label, count]) => ({ label, count }));

    const gearSalesTotal = gearTxns
      .filter(t => t.transaction_state === 'released')
      .reduce((s, t) => s + Number(t.agreed_price || 0), 0);
    const gearSalesCount = gearTxns.filter(t => t.transaction_state === 'released').length;

    return NextResponse.json({
      totalPlays,
      totalLikes,
      totalComments,
      totalMixes: profileMixes.length,
      followers,
      following,
      averagePlaysPerMix: profileMixes.length ? Math.round(totalPlays / profileMixes.length) : 0,
      likeToPlayRatio: totalPlays ? Number(((totalLikes / totalPlays) * 100).toFixed(1)) : 0,
      followerEngagementRate: followers ? Number((((totalLikes + totalComments) / followers) * 100).toFixed(1)) : 0,
      uploadFrequencyDays,
      topMixes: sortedMixes,
      genreDistribution,
      weeklyEvents,
      gearSalesTotal,
      gearSalesCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
