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
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const depth = Math.min(parseInt(searchParams.get('depth') || '2'), 3);
    const windowDays = Math.min(parseInt(searchParams.get('window_days') || '365'), 730);
    const edgeTypes = searchParams.get('edge_types')?.split(',').filter(Boolean);
    const nodeTypes = searchParams.get('node_types')?.split(',').filter(Boolean);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    // Get the user's artist node
    const { data: artistNode } = await sb
      .from('mythic_nodes')
      .select('id, title, node_type, payload')
      .eq('source_table', 'profiles')
      .eq('source_id', user.id)
      .maybeSingle();

    if (!artistNode) {
      return NextResponse.json({
        center: null,
        nodes: [],
        edges: [],
        message: 'No mythic node yet for this user. Run backfill or create activity first.',
      });
    }

    // Get outgoing edges
    let edgesQuery = sb
      .from('mythic_edges')
      .select('*, from_node:mythic_nodes!mythic_edges_from_node_id_fkey(*), to_node:mythic_nodes!mythic_edges_to_node_id_fkey(*)')
      .or(`from_node_id.eq.${artistNode.id},to_node_id.eq.${artistNode.id}`)
      .limit(limit);

    if (edgeTypes && edgeTypes.length > 0) {
      edgesQuery = edgesQuery.in('edge_type', edgeTypes);
    }

    if (windowDays < 730) {
      const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
      edgesQuery = edgesQuery.gte('occurred_at', cutoff);
    }

    const { data: edges, error: edgesErr } = await edgesQuery;

    if (edgesErr) throw edgesErr;

    // Collect all node IDs from edges
    const nodeIds = new Set<string>();
    nodeIds.add(artistNode.id);
    if (edges) {
      for (const e of edges) {
        if (e.from_node?.id) nodeIds.add(e.from_node.id);
        if (e.to_node?.id) nodeIds.add(e.to_node.id);
      }
    }

    // If depth > 1, fetch second hop
    let deeperEdges: any[] = [];
    if (depth >= 2) {
      const neighborIds = Array.from(nodeIds).filter(id => id !== artistNode.id);

      if (neighborIds.length > 0) {
        const hop2Query = sb
          .from('mythic_edges')
          .select('*, from_node:mythic_nodes!mythic_edges_from_node_id_fkey(*), to_node:mythic_nodes!mythic_edges_to_node_id_fkey(*)')
          .in('from_node_id', neighborIds)
          .limit(limit);

        if (edgeTypes && edgeTypes.length > 0) {
          hop2Query.in('edge_type', edgeTypes);
        }

        const { data: hop2 } = await hop2Query;
        if (hop2) {
          deeperEdges = hop2;
          for (const e of hop2) {
            if (e.from_node?.id) nodeIds.add(e.from_node.id);
            if (e.to_node?.id) nodeIds.add(e.to_node.id);
          }
        }
      }
    }

    // Build node list, filtering by node_type if requested
    const allNodes = [artistNode];
    const seenIds = new Set([artistNode.id]);

    for (const e of [...(edges || []), ...deeperEdges]) {
      for (const n of [e.from_node, e.to_node]) {
        if (n && !seenIds.has(n.id) && n.id) {
          seenIds.add(n.id);
          if (!nodeTypes || nodeTypes.length === 0 || nodeTypes.includes(n.node_type)) {
            allNodes.push(n);
          }
        }
      }
    }

    return NextResponse.json({
      center: artistNode,
      nodes: allNodes,
      edges: [...(edges || []), ...deeperEdges],
      meta: {
        depth,
        window_days: windowDays,
        node_count: allNodes.length,
        edge_count: (edges?.length || 0) + deeperEdges.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
