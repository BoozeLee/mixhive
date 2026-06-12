'use client';

import { useCallback, useEffect, useState } from 'react';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
import { useAuth } from '../hooks/useAuth';
import { completeMilestone } from '../lib/api';
import toast from 'react-hot-toast';

interface OutcomeNode {
  id: string;
  node_type: string;
  title: string | null;
  occurred_at: string | null;
}

interface OutcomeLinkModalProps {
  milestoneId: string;
  onClose: () => void;
  /** Called after the milestone is completed (with or without an outcome link). */
  onDone: () => void;
}

// Career artefacts that can plausibly be "the outcome" a milestone produced.
const OUTCOME_NODE_TYPES = ['event', 'opportunity', 'mix', 'buzz', 'label'];

export function OutcomeLinkModal({ milestoneId, onClose, onDone }: OutcomeLinkModalProps) {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<OutcomeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { supabase, isSupabaseConfigured } = await import('@/lib/supabase');
      if (!isSupabaseConfigured) {
        setNodes([]);
        return;
      }
      const { data } = await supabase
        .from('mythic_nodes')
        .select('id, node_type, title, occurred_at')
        .eq('owner_id', user.id)
        .in('node_type', OUTCOME_NODE_TYPES)
        .order('occurred_at', { ascending: false, nullsFirst: false })
        .limit(25);
      setNodes((data as OutcomeNode[]) ?? []);
    } catch (e) {
      console.warn('Failed to load outcome nodes', e);
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const linkOutcome = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const selected = nodes.find(n => n.id === selectedId);
      const { error } = await supabase.rpc('record_milestone_outcome', {
        p_milestone_id: milestoneId,
        p_outcome_node_id: selectedId,
        p_outcome_type: selected?.node_type ?? null,
        p_rationale: rationale.trim() || null,
      });
      if (error) throw error;
      toast.success('Outcome linked — added to your Mythic graph');
      onDone();
    } catch (e) {
      console.error('Failed to record outcome', e);
      toast.error('Could not link that outcome');
    } finally {
      setSaving(false);
    }
  };

  const completeWithout = async () => {
    setSaving(true);
    try {
      const ok = await completeMilestone(milestoneId, []);
      if (!ok) throw new Error('completeMilestone returned false');
      toast.success('Milestone completed');
      onDone();
    } catch (e) {
      console.error('Failed to complete milestone', e);
      toast.error('Could not complete the milestone');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Link an outcome"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: space[4],
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.surface,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: radius.lg,
          padding: space[5],
          width: '100%',
          maxWidth: 540,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, margin: 0 }}>
          What did this milestone produce?
        </h2>
        <p
          style={{
            fontSize: fontSize.sm,
            color: colors.text.muted,
            margin: `${space[1]}px 0 ${space[4]}px`,
          }}
        >
          Linking the real outcome (a booking, opportunity, release…) builds the causal chain your
          Yield Forensics can trace. Optional — you can complete without one.
        </p>

        {loading ? (
          <div style={{ color: colors.text.muted, padding: space[4] }}>Loading your graph…</div>
        ) : nodes.length === 0 ? (
          <div style={{ color: colors.text.muted, fontSize: fontSize.sm, marginBottom: space[4] }}>
            No outcome nodes yet. Log a gig or publish a mix first, then link it here.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: space[2],
              marginBottom: space[4],
            }}
          >
            {nodes.map(n => {
              const active = selectedId === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedId(active ? null : n.id)}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${active ? colors.accent : colors.border}`,
                    background: active ? colors.accentFaint : colors.bg,
                    borderRadius: radius.md,
                    padding: `${space[2]}px ${space[3]}px`,
                    cursor: 'pointer',
                    color: colors.text.primary,
                  }}
                >
                  <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>
                    {n.title || 'Untitled'}
                  </span>
                  <span style={{ fontSize: 11, color: colors.text.muted, marginLeft: space[2] }}>
                    {n.node_type}
                    {n.occurred_at ? ` · ${new Date(n.occurred_at).toLocaleDateString()}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selectedId && (
          <input
            type="text"
            value={rationale}
            onChange={e => setRationale(e.target.value)}
            placeholder="How did this milestone lead to it? (optional)"
            style={{
              width: '100%',
              padding: `${space[2]}px ${space[3]}px`,
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.sm,
              color: colors.text.primary,
              fontSize: fontSize.sm,
              marginBottom: space[4],
            }}
          />
        )}

        <div
          style={{ display: 'flex', gap: space[2], justifyContent: 'flex-end', flexWrap: 'wrap' }}
        >
          <HiveButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </HiveButton>
          <HiveButton variant="ghost" onClick={completeWithout} disabled={saving}>
            Complete without linking
          </HiveButton>
          <HiveButton variant="primary" onClick={linkOutcome} disabled={saving || !selectedId}>
            {saving ? 'Saving…' : 'Link outcome & complete'}
          </HiveButton>
        </div>
      </div>
    </div>
  );
}
