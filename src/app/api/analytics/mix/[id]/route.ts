import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: mix } = await sb.from('mixes').select('dj_id, duration_seconds').eq('id', params.id).single();
    if (!mix) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (mix.dj_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${_req.headers.get('authorization')?.slice(7) || ''}` } },
      auth: { persistSession: false },
    });

    const [eventsResult, playHistoryResult] = await Promise.all([
      userClient
        .from('analytics_events')
        .select('event_type, metadata, created_at')
        .eq('mix_id', params.id)
        .order('created_at', { ascending: false }),
      userClient
        .from('play_history')
        .select('user_id, duration_seconds, created_at')
        .eq('mix_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

    const events = eventsResult.data || [];
    const playHistory = playHistoryResult.data || [];

    const totalPlays = events.filter(e => e.event_type === 'mix_play' || e.event_type === 'play').length;
    const totalLikes = events.filter(e => e.event_type === 'mix_like' || e.event_type === 'like').length;
    const totalComments = events.filter(e => e.event_type === 'comment_create' || e.event_type === 'comment').length;
    const totalShares = events.filter(e => e.event_type === 'mix_share' || e.event_type === 'share').length;

    const playsByDay: Record<string, number> = {};
    events.forEach(e => {
      if (e.event_type === 'mix_play' || e.event_type === 'play') {
        const day = new Date(e.created_at).toISOString().slice(0, 10);
        playsByDay[day] = (playsByDay[day] || 0) + 1;
      }
    });

    const topReferrers: Record<string, number> = {};
    events.forEach(e => {
      const ref = (e.metadata as Record<string, unknown>)?.referrer as string;
      if (ref) {
        topReferrers[ref] = (topReferrers[ref] || 0) + 1;
      }
    });

    const geoDistribution: Record<string, number> = {};
    events.forEach(e => {
      const country = (e.metadata as Record<string, unknown>)?.country as string;
      if (country) {
        geoDistribution[country] = (geoDistribution[country] || 0) + 1;
      }
    });

    const completedPlays = playHistory.filter(
      p => mix.duration_seconds && (p.duration_seconds || 0) >= mix.duration_seconds * 0.9
    ).length;
    const completionRate = playHistory.length > 0 ? completedPlays / playHistory.length : 0;
    const engagementRate = totalPlays > 0 ? (totalLikes + totalComments + totalShares) / totalPlays : 0;

    return NextResponse.json({
      mixId: params.id,
      totalPlays,
      totalLikes,
      totalComments,
      totalShares,
      engagementRate: Math.round(engagementRate * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      playsByDay: Object.entries(playsByDay)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topReferrers: Object.entries(topReferrers)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      geoDistribution: Object.entries(geoDistribution)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (e) { return handleApiError(e); }
}
