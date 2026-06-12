'use client';

import { useCallback, useEffect, useState } from 'react';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

// Edges awaiting the user's confirmation. The graph processor / agents write these
// with metadata.status 'proposed' (collab sessions) or 'pending' (/api/mythic/propose).
const PENDING_STATUSES = ['proposed', 'pending'];

interface ProposalEdge {
  id: string;
  edge_type: string;
  weight: number | null;
  source_event: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ProposalsInboxProps {
  /** Reports the current pending count to the parent (e.g. for a section heading badge). */
  onCountChange?: (count: number) => void;
}

function metaString(meta: Record<string, unknown> | null, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function sourceLabel(edge: ProposalEdge): string {
  const m = edge.metadata;
  const session = metaString(m, 'session_title');
  if (session) return `Collab session · ${session}`;
  const agent = metaString(m, 'agent_id');
  if (agent) return `Agent · ${agent.slice(0, 8)}`;
  const src = edge.source_event ?? '';
  if (src.startsWith('lua_agent:'))
    return `Agent · ${src.slice('lua_agent:'.length, 'lua_agent:'.length + 8)}`;
  if (src.startsWith('collab_session:')) return 'Collab session';
  return 'MixHive';
}

function rationaleFor(edge: ProposalEdge): string {
  return (
    metaString(edge.metadata, 'rationale') ??
    metaString(edge.metadata, 'draft_text') ??
    `A ${edge.edge_type.replace(/_/g, ' ')} relationship detected from your recent activity.`
  );
}

function confidencePct(weight: number | null): number | null {
  if (weight == null || Number.isNaN(weight)) return null;
  return Math.round(Math.min(1, Math.max(0, weight)) * 100);
}

export function ProposalsInbox({ onCountChange }: ProposalsInboxProps) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<ProposalEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import('@/lib/supabase');
      if (!isSupabaseConfigured) {
        setProposals([]);
        return;
      }
      // RLS scopes mythic_edges to those touching the user's own nodes (same trust
      // path PostSessionReview relies on).
      const { data, error } = await supabase
        .from('mythic_edges')
        .select('id, edge_type, weight, source_event, metadata, created_at')
        .in('metadata->>status', PENDING_STATUSES)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setProposals((data as ProposalEdge[]) ?? []);
    } catch (e) {
      console.warn('Failed to load pending proposals', e);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  useEffect(() => {
    onCountChange?.(proposals.length);
  }, [proposals.length, onCountChange]);

  const resolve = async (edge: ProposalEdge, status: 'approved' | 'rejected') => {
    setBusyId(edge.id);
    const snapshot = proposals;
    setProposals(prev => prev.filter(x => x.id !== edge.id)); // optimistic
    try {
      const { supabase } = await import('@/lib/supabase');
      // Read-modify-write: preserve existing metadata (rationale, session_title, …)
      // rather than replacing the whole jsonb.
      const nextMeta = {
        ...(edge.metadata ?? {}),
        status,
        reviewed_at: new Date().toISOString(),
        approved_by_user: status === 'approved',
      };
      const { error } = await supabase
        .from('mythic_edges')
        .update({ metadata: nextMeta })
        .eq('id', edge.id);
      if (error) throw error;
      toast.success(status === 'approved' ? 'Added to your Mythic graph' : 'Proposal dismissed', {
        duration: 2500,
      });
    } catch (e) {
      console.error('Failed to resolve proposal', e);
      toast.error('Could not update the proposal');
      setProposals(snapshot); // rollback
    } finally {
      setBusyId(null);
    }
  };

  // Stay invisible until there is something to confirm.
  if (loading || proposals.length === 0) return null;

  return (
    <section
      aria-label="Pending proposals"
      style={{
        background: colors.surface,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.lg,
        padding: space[5],
        marginBottom: space[6],
      }}
    >
      <div style={{ marginBottom: space[4] }}>
        <h2
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            margin: 0,
          }}
        >
          Pending proposals ({proposals.length})
        </h2>
        <p style={{ fontSize: fontSize.sm, color: colors.text.muted, margin: `${space[1]}px 0 0` }}>
          Your agents and sessions suggested these graph connections. Approve to add them to your
          Mythic legend, or dismiss.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
        {proposals.map(edge => {
          const pct = confidencePct(edge.weight);
          const busy = busyId === edge.id;
          return (
            <div
              key={edge.id}
              style={{
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                borderRadius: radius.md,
                padding: space[4],
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: space[4],
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[2],
                    marginBottom: space[1],
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: fontWeight.bold,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      color: colors.accent,
                      background: colors.accentFaint,
                      padding: '2px 8px',
                      borderRadius: radius.sm,
                    }}
                  >
                    {edge.edge_type.replace(/_/g, ' ')}
                  </span>
                  {pct != null && (
                    <span style={{ fontSize: 11, color: colors.text.faint }}>
                      {pct}% confidence
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: fontSize.sm,
                    color: colors.text.secondary,
                    marginBottom: space[1],
                  }}
                >
                  {rationaleFor(edge)}
                </div>
                <div style={{ fontSize: 12, color: colors.text.muted }}>{sourceLabel(edge)}</div>
              </div>

              <div style={{ display: 'flex', gap: space[2], flexShrink: 0 }}>
                <HiveButton
                  variant="primary"
                  onClick={() => resolve(edge, 'approved')}
                  disabled={busy}
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  {busy ? '…' : 'Approve'}
                </HiveButton>
                <HiveButton
                  variant="secondary"
                  onClick={() => resolve(edge, 'rejected')}
                  disabled={busy}
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  Dismiss
                </HiveButton>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
