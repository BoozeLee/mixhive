'use client';

import React, { useState, useEffect } from 'react';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
import toast from 'react-hot-toast';

interface ProposedUpdate {
  id: string;
  type: string;
  title: string;
  description: string;
  participants?: string[];
}

interface PostSessionReviewProps {
  sessionId: string;
  sessionTitle: string;
  onClose: () => void;
  onApproved?: () => void;
}

export function PostSessionReview({
  sessionId,
  sessionTitle,
  onClose,
  onApproved,
}: PostSessionReviewProps) {
  const [proposedUpdates, setProposedUpdates] = useState<ProposedUpdate[]>([]);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real edges created from this session (populated by the job processor)
  useEffect(() => {
    const fetchSessionOutcomes = async () => {
      try {
        // In a real app this would be a dedicated endpoint or RPC.
        // For now we query mythic_edges directly with the session_id in metadata.
        const { supabase } = await import('@/lib/supabase');

        const { data: edges } = await supabase
          .from('mythic_edges')
          .select('*')
          .eq('source_event', `collab_session:${sessionId}`)
          .limit(20);

        if (edges && edges.length > 0) {
          const formatted = edges.map((edge: any) => ({
            id: edge.id,
            type: edge.edge_type,
            title: `${edge.edge_type} with other participant(s)`,
            description: `Collaboration edge created automatically when the session "${sessionTitle}" ended.`,
            participants: edge.metadata?.participants,
          }));
          setProposedUpdates(formatted);
        } else setProposedUpdates([]);
      } catch (e) {
        setProposedUpdates([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionOutcomes();
  }, [sessionId, sessionTitle]);

  const toggleApprove = (id: string) => {
    setApprovedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleDiscard = (id: string) => {
    setProposedUpdates(prev => prev.filter(item => item.id !== id));
    setApprovedIds(prev => prev.filter(x => x !== id));
  };

  const handleApproveSelected = async () => {
    if (approvedIds.length === 0) {
      toast.error('Please approve at least one update');
      return;
    }

    setIsSubmitting(true);

    try {
      const { supabase } = await import('@/lib/supabase');

      // Real update: mark selected edges as approved with user provenance
      const { error } = await supabase
        .from('mythic_edges')
        .update({
          metadata: {
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by_user: true,
          },
        })
        .in('id', approvedIds);

      if (error) throw error;

      const approvedCount = approvedIds.length;

      toast.success(
        `${approvedCount} session outcome${approvedCount > 1 ? 's' : ''} written to your Mythic graph.`,
        { duration: 4000 }
      );

      onApproved?.();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to write approved updates to graph');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.lg,
        padding: 24,
        maxWidth: 720,
        width: '100%',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
          Review Session Outcomes
        </div>
        <div style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
          {sessionTitle} • These changes will be added to your Mythic legend
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        {proposedUpdates.length === 0 ? (
          <div style={{ color: colors.text.muted, padding: 20, textAlign: 'center' }}>
            No proposed updates.
          </div>
        ) : (
          proposedUpdates.map(update => {
            const isApproved = approvedIds.includes(update.id);

            return (
              <div
                key={update.id}
                style={{
                  border: `1px solid ${isApproved ? colors.accent : colors.border}`,
                  background: isApproved ? colors.accentFaint : colors.bg,
                  borderRadius: radius.md,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: fontWeight.medium, marginBottom: 4 }}>
                      {update.title}
                    </div>
                    <div
                      style={{
                        fontSize: fontSize.sm,
                        color: colors.text.secondary,
                        marginBottom: 8,
                      }}
                    >
                      {update.description}
                    </div>
                    {update.participants && (
                      <div style={{ fontSize: 12, color: colors.text.muted }}>
                        Participants: {update.participants.join(', ')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                    <HiveButton
                      variant={isApproved ? 'primary' : 'secondary'}
                      onClick={() => toggleApprove(update.id)}
                      style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                      {isApproved ? 'Approved' : 'Approve'}
                    </HiveButton>

                    <HiveButton
                      variant="secondary"
                      onClick={() => handleDiscard(update.id)}
                      style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                      Discard
                    </HiveButton>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <HiveButton variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </HiveButton>

        <HiveButton
          variant="primary"
          onClick={handleApproveSelected}
          disabled={isSubmitting || approvedIds.length === 0}
        >
          {isSubmitting
            ? 'Writing to Graph...'
            : `Approve Selected (${approvedIds.length}) & Write to Graph`}
        </HiveButton>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: colors.text.faint, textAlign: 'center' }}>
        Approved changes will create edges in your MythicNode graph and become visible to your
        agents.
      </div>
    </div>
  );
}
