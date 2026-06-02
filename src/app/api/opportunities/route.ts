import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Opportunity } from '../../../lib/types';

const fallbackOpportunities: Opportunity[] = [
  {
    id: 'pilot-kiosk-radio-summer-2026',
    title: 'Kiosk Radio Open Submission — Summer 2026',
    description:
      'Brussels community radio call for DJs and selectors with 60-90 minute sets across underground electronic, leftfield, jazz, and experimental sounds.',
    opp_type: 'radio',
    source: 'manual',
    source_url: null,
    organizer: 'Kiosk Radio',
    location: 'Place du Jeu de Balle, Brussels',
    city: 'Brussels',
    country: 'BE',
    compensation: 'Fee negotiated per session',
    deadline: '2026-06-30',
    genres: ['techno', 'ambient', 'leftfield', 'jazz', 'experimental'],
    roles: ['dj', 'selector'],
    tags: ['radio', 'community', 'underground'],
    is_active: true,
    created_at: '2026-05-27T00:00:00.000Z',
  },
  {
    id: 'pilot-fuse-resident-search-2026',
    title: 'Fuse Brussels Resident DJ Search',
    description:
      'Resident search for techno, industrial, and peak-time electronic DJs. Submit a recorded set and a short motivation.',
    opp_type: 'gig',
    source: 'manual',
    source_url: null,
    organizer: 'Fuse Brussels',
    location: 'Rue Blaes 208, Brussels',
    city: 'Brussels',
    country: 'BE',
    compensation: 'Resident fee + guest arrangement',
    deadline: '2026-07-15',
    genres: ['techno', 'industrial', 'hard techno'],
    roles: ['dj', 'resident'],
    tags: ['club', 'resident', 'techno'],
    is_active: true,
    created_at: '2026-05-27T00:00:00.000Z',
  },
  {
    id: 'pilot-listen-emerging-grant-2026',
    title: 'Listen! Festival Artist Grant — Emerging Talent',
    description:
      'Development grant for Belgian electronic artists. Open to DJs, producers, and live acts with an EPK and work-in-progress recording.',
    opp_type: 'grant',
    source: 'manual',
    source_url: null,
    organizer: 'Listen! Festival',
    location: 'Brussels',
    city: 'Brussels',
    country: 'BE',
    compensation: '€1000 development grant',
    deadline: '2026-08-15',
    genres: ['electronic', 'experimental', 'club', 'ambient'],
    roles: ['dj', 'producer', 'live act'],
    tags: ['grant', 'emerging', 'development'],
    is_active: true,
    created_at: '2026-05-27T00:00:00.000Z',
  },
  {
    id: 'pilot-kompass-new-face-2026',
    title: 'Kompass Klub Ghent — New Face Night',
    description:
      'Monthly new-talent slot for undiscovered local DJs. One-hour set, no experience minimum. Submit a mix and three-line bio.',
    opp_type: 'gig',
    source: 'manual',
    source_url: null,
    organizer: 'Kompass Klub',
    location: 'Doornzelestraat 49, Ghent',
    city: 'Ghent',
    country: 'BE',
    compensation: '€75 + drinks',
    deadline: '2026-06-20',
    genres: ['techno', 'house', 'leftfield'],
    roles: ['dj'],
    tags: ['club', 'new talent', 'ghent'],
    is_active: true,
    created_at: '2026-05-27T00:00:00.000Z',
  },
];

function filterFallback(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city')?.toLowerCase();
  const genre = searchParams.get('genre')?.toLowerCase();
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  return fallbackOpportunities
    .filter(opp => !city || opp.city?.toLowerCase().includes(city))
    .filter(opp => !type || opp.opp_type === type)
    .filter(opp => !genre || opp.genres.some(g => g.toLowerCase() === genre))
    .slice(0, limit);
}

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({
      opportunities: filterFallback(req),
      source: 'fallback',
    });
  }

  const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const genre = searchParams.get('genre');
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  let query = sb
    .from('opportunities')
    .select('*')
    .eq('is_active', true)
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (city) query = query.ilike('city', `%${city}%`);
  if (type) query = query.eq('opp_type', type);
  if (genre) query = query.contains('genres', [genre]);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({
      opportunities: filterFallback(req),
      source: 'fallback',
      warning: error.message,
    });
  }
  return NextResponse.json({ opportunities: data ?? [], source: 'supabase' });
}
