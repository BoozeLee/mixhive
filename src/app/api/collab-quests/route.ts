import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeClient(jwt?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, {
    global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    auth: { persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const discipline = searchParams.get('discipline');
    const phase = searchParams.get('phase') ?? 'recruiting';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const sb = makeClient();
    let q = sb
      .from('collab_quests')
      .select('*, collab_roles(id, role_type, title, status)', { count: 'exact' })
      .eq('phase', phase)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (discipline) {
      q = q.contains('discipline_tags', [discipline]);
    }

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ quests: data ?? [], total: count ?? 0, offset, limit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);
    const sb = makeClient(jwt);

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      narrative,
      goals,
      genre_tags,
      discipline_tags,
      region,
      timeline_days,
      deadline,
      xp_reward,
      roles,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
    if (!goals?.length)
      return NextResponse.json({ error: 'At least one goal required' }, { status: 400 });

    const { data: quest, error: questErr } = await sb
      .from('collab_quests')
      .insert({
        creator_profile_id: user.id,
        title: title.trim(),
        narrative,
        goals: goals ?? [],
        genre_tags: genre_tags ?? [],
        discipline_tags: discipline_tags ?? [],
        region,
        timeline_days,
        deadline,
        xp_reward: xp_reward ?? 100,
        phase: 'draft',
      })
      .select()
      .single();

    if (questErr) throw questErr;

    // Insert roles if provided
    if (roles?.length) {
      const roleRows = roles.map((r: Record<string, unknown>) => ({
        quest_id: quest.id,
        role_type: r.role_type,
        title: r.title,
        skill_tags: r.skill_tags ?? [],
        experience_level: r.experience_level ?? 'any',
        is_paid: r.is_paid ?? false,
        compensation_notes: r.compensation_notes,
        status: 'open',
      }));
      const { error: rolesErr } = await sb.from('collab_roles').insert(roleRows);
      if (rolesErr) throw rolesErr;
    }

    return NextResponse.json({ quest }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
