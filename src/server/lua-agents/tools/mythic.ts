// MythicNode-specific tools for strategic agents.
// These provide clean, high-level access to the graph and quests
// instead of raw table reads.

import { createClient } from '@supabase/supabase-js';

let _admin: unknown = null;

function adminClient() {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    _admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return _admin;
}

export const mythicTools = {
  'mythic.quest.get_active': async (profileId: string) => {
    const { data, error } = await adminClient()
      .from('quests')
      .select('*')
      .eq('owner_id', profileId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) throw new Error(`mythic.quest.get_active: ${error.message}`);
    return data ?? [];
  },

  'mythic.graph.query': async (params: {
    from_node_id?: string;
    to_node_id?: string;
    edge_type?: string;
    limit?: number;
  }) => {
    let q = adminClient().from('mythic_edges').select('*');

    if (params.from_node_id) q = q.eq('from_node_id', params.from_node_id);
    if (params.to_node_id) q = q.eq('to_node_id', params.to_node_id);
    if (params.edge_type) q = q.eq('edge_type', params.edge_type);

    const { data, error } = await q.limit(params.limit ?? 30);
    if (error) throw new Error(`mythic.graph.query: ${error.message}`);
    return data ?? [];
  },

  'mythic.yield.get_summary': async (profileId: string, days = 180) => {
    // Placeholder - can be expanded with real aggregation later
    const { data, error } = await adminClient()
      .from('mythic_edges')
      .select('*')
      .eq('from_node_id', profileId)
      .eq('edge_type', 'yielded_outcome')
      .gte('occurred_at', new Date(Date.now() - days * 86400000).toISOString());

    if (error) throw new Error(`mythic.yield.get_summary: ${error.message}`);
    return { outcomes: data ?? [], count: data?.length ?? 0 };
  },

  'mythic.node.find_or_create': async (params: {
    node_type: string;
    source_table: string;
    source_id: string;
    title: string;
    owner_id: string;
    payload?: Record<string, unknown>;
  }) => {
    const { data: existing } = await adminClient()
      .from('mythic_nodes')
      .select('id')
      .eq('source_table', params.source_table)
      .eq('source_id', params.source_id)
      .maybeSingle();
    if (existing) return existing.id as string;

    const { data, error } = await adminClient()
      .from('mythic_nodes')
      .insert({
        node_type: params.node_type,
        source_table: params.source_table,
        source_id: params.source_id,
        title: params.title,
        owner_id: params.owner_id,
        payload: params.payload ?? {},
      })
      .select('id')
      .single();
    if (error) throw new Error(`mythic.node.find_or_create: ${error.message}`);
    return data.id as string;
  },

  'mythic.edge.create': async (params: {
    from_node_id: string;
    to_node_id: string;
    edge_type: string;
    weight?: number;
    metadata?: Record<string, unknown>;
    source_event?: string;
  }) => {
    const { error } = await adminClient()
      .from('mythic_edges')
      .insert({
        from_node_id: params.from_node_id,
        to_node_id: params.to_node_id,
        edge_type: params.edge_type,
        weight: params.weight ?? 1.0,
        metadata: params.metadata ?? {},
        source_event: params.source_event ?? 'agent',
        occurred_at: new Date().toISOString(),
      });
    if (error) throw new Error(`mythic.edge.create: ${error.message}`);
    return true;
  },
};
