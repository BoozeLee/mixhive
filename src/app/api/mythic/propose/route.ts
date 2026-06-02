import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    const serviceToken = process.env.SERVICE_ROLE_TOKEN;
    if (!authHeader?.startsWith('Bearer ') || (serviceToken && authHeader.slice(7) !== serviceToken)) {
      return NextResponse.json({ error: 'Invalid service token' }, { status: 401 });
    }

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { action_type, target_node_id, rationale, draft_text, agent_id, from_node_id } = await req.json();

    if (!action_type || !target_node_id || !rationale) {
      return NextResponse.json({ error: 'action_type, target_node_id, and rationale are required' }, { status: 400 });
    }

    if (!['recommended_by_agent'].includes(action_type)) {
      return NextResponse.json({ error: 'Invalid action_type' }, { status: 400 });
    }

    // Create a recommended_by_agent edge
    const { data: edge, error } = await sb
      .from('mythic_edges')
      .insert({
        from_node_id: from_node_id || target_node_id,
        to_node_id: target_node_id,
        edge_type: 'recommended_by_agent',
        weight: 1.0,
        occurred_at: new Date().toISOString(),
        source_event: agent_id ? `lua_agent:${agent_id}` : 'lua_agent:unknown',
        metadata: {
          action_type,
          rationale,
          draft_text: draft_text || null,
          agent_id: agent_id || null,
          status: 'pending',
        },
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ proposal: edge }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
