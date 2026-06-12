'use client';

import { useCallback, useEffect, useState } from 'react';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
import { useAuth } from '../hooks/useAuth';

interface OutcomeNodeRef {
  id: string;
  title: string | null;
  node_type: string;
}

interface OutcomeEdge {
  id: string;
  edge_type: string;
  occurred_at: string | null;
  metadata: Record<string, unknown> | null;
  to_node: OutcomeNodeRef | OutcomeNodeRef[] | null;
}

interface TraceRow {
  depth: number;
  edge_id: string;
  edge_type: string;
  from_title: string | null;
  from_type: string;
  to_title: string | null;
  to_type: string;
  occurred_at: string | null;
}

function outcomeNode(edge: OutcomeEdge): OutcomeNodeRef | null {
  const n = edge.to_node;
  if (!n) return null;
  return Array.isArray(n) ? (n[0] ?? null) : n;
}

function metaString(meta: Record<string, unknown> | null, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

export function YieldForensicsPanel() {
  const { user } = useAuth();
  const [outcomes, setOutcomes] = useState<OutcomeEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [traces, setTraces] = useState<Record<string, TraceRow[]>>({});
  const [tracingId, setTracingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { supabase, isSupabaseConfigured } = await import('@/lib/supabase');
      if (!isSupabaseConfigured) {
        setOutcomes([]);
        return;
      }
      // SELECT is allowed for the owner of the edge's from-node (045 policy).
      const { data } = await supabase
        .from('mythic_edges')
        .select(
          'id, edge_type, occurred_at, metadata, to_node:mythic_nodes!to_node_id(id, title, node_type)'
        )
        .eq('edge_type', 'yielded_outcome')
        .order('occurred_at', { ascending: false, nullsFirst: false })
        .limit(10);
      setOutcomes((data as unknown as OutcomeEdge[]) ?? []);
    } catch (e) {
      console.warn('Failed to load yield outcomes', e);
      setOutcomes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const trace = async (edgeId: string) => {
    if (traces[edgeId]) {
      setTraces(prev => {
        const next = { ...prev };
        delete next[edgeId];
        return next;
      });
      return;
    }
    setTracingId(edgeId);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.rpc('trace_outcome_causation', {
        p_outcome_edge_id: edgeId,
        p_max_depth: 5,
      });
      if (error) throw error;
      setTraces(prev => ({ ...prev, [edgeId]: (data as TraceRow[]) ?? [] }));
    } catch (e) {
      console.warn('Failed to trace causation', e);
      setTraces(prev => ({ ...prev, [edgeId]: [] }));
    } finally {
      setTracingId(null);
    }
  };

  if (loading || outcomes.length === 0) return null;

  return (
    <section
      aria-label="Yield forensics"
      style={{
        background: colors.surface,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.lg,
        padding: space[5],
        marginBottom: space[6],
      }}
    >
      <div style={{ marginBottom: space[4] }}>
        <h2 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, margin: 0 }}>
          Yield Forensics
        </h2>
        <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: `${space[1]}px 0 0` }}>
          Real outcomes you logged — trace the chain of actions associated with each.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
        {outcomes.map(edge => {
          const node = outcomeNode(edge);
          const chain = traces[edge.id];
          return (
            <div
              key={edge.id}
              style={{
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                borderRadius: radius.md,
                padding: space[4],
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: space[3],
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
                    {node?.title || 'Outcome'}
                  </div>
                  <div style={{ fontSize: 12, color: colors.text.muted }}>
                    {node?.node_type ?? 'outcome'}
                    {edge.occurred_at
                      ? ` · ${new Date(edge.occurred_at).toLocaleDateString()}`
                      : ''}
                    {metaString(edge.metadata, 'rationale')
                      ? ` · ${metaString(edge.metadata, 'rationale')}`
                      : ''}
                  </div>
                </div>
                <HiveButton
                  variant="ghost"
                  onClick={() => trace(edge.id)}
                  disabled={tracingId === edge.id}
                  style={{ fontSize: 12, padding: '6px 12px', flexShrink: 0 }}
                >
                  {tracingId === edge.id ? '…' : chain ? 'Hide chain' : 'Trace causal chain'}
                </HiveButton>
              </div>

              {chain && (
                <div
                  style={{
                    marginTop: space[3],
                    paddingTop: space[3],
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  {chain.length === 0 ? (
                    <div style={{ fontSize: 12, color: colors.text.faint }}>
                      No predecessor actions found for this outcome yet.
                    </div>
                  ) : (
                    <ol
                      style={{
                        margin: 0,
                        paddingLeft: space[4],
                        display: 'flex',
                        flexDirection: 'column',
                        gap: space[1],
                      }}
                    >
                      {chain.map(row => (
                        <li
                          key={row.edge_id}
                          style={{ fontSize: 12, color: colors.text.secondary }}
                        >
                          <span style={{ color: colors.accent }}>
                            {row.edge_type.replace(/_/g, ' ')}
                          </span>
                          {' · '}
                          {row.from_title || row.from_type} → {row.to_title || row.to_type}
                          {row.occurred_at
                            ? ` · ${new Date(row.occurred_at).toLocaleDateString()}`
                            : ''}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
