import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { moderateContent } from '@/lib/moderation';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

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

    // Fetch existing mix to verify ownership
    const { data: existing } = await sb
      .from('mixes')
      .select('id, dj_id, description')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Mix not found' }, { status: 404 });
    }
    if (existing.dj_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { description, title, artwork_url, tags } = await req.json();

    const updates: Record<string, unknown> = {};
    if (description !== undefined) updates.description = description;
    if (title !== undefined) updates.title = title;
    if (artwork_url !== undefined) updates.artwork_url = artwork_url;
    if (tags !== undefined) updates.tags = tags;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: mix, error } = await sb
      .from('mixes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Trigger moderation if description changed
    if (description !== undefined && description !== existing.description) {
      await moderateContent('mixes', id, description);
    }

    return NextResponse.json(mix);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
