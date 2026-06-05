import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = sb
      .from('quests')
      .select('*, milestones:quest_milestones(*)', { count: 'exact' })
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ['active', 'paused', 'completed', 'abandoned'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: quests, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ quests: quests || [], total: count || 0, limit, offset });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { title, description, target_scene_tags, timeframe_days, created_by_agent_id } =
      await req.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const { data: quest, error } = await sb
      .from('quests')
      .insert({
        owner_id: user.id,
        title: title.trim(),
        description: description || null,
        target_scene_tags: target_scene_tags || [],
        timeframe_days: timeframe_days || null,
        created_by_agent_id: created_by_agent_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Fire-and-forget experiment event
    const hash = user.id.replace(/-/g, '').slice(0, 8);
    const variant = parseInt(hash, 16) % 2 === 0 ? 'treatment' : 'control';
    void sb.from('experiment_events').insert({
      profile_id: user.id,
      event_type: 'mythic_quest_started',
      feature: 'mythic_quest_lines',
      variant,
      properties: {
        quest_id: quest.id,
        source: created_by_agent_id ? 'agent_proposed' : 'user_created',
      },
    });

    return NextResponse.json(quest, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
