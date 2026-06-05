import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';
import { HiveCard } from '../components/hive/HiveCard';
import { HiveButton } from '../components/hive/HiveButton';
import { EmptyState } from '../components/EmptyState';
import { NftMintModal } from '../components/NftMintModal';
import { getQuestDetail, completeMilestone } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { QuestWithMilestones } from '../lib/types';

interface NextAction {
  id: string;
  title: string;
  rationale: string;
  target_type: string;
  confidence: number;
}

export function QuestDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [questData, setQuestData] = useState<QuestWithMilestones | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [showNftModal, setShowNftModal] = useState(false);

  const refreshQuest = async () => {
    if (!id) return;
    const data = await getQuestDetail(id);
    setQuestData(data);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getQuestDetail(id)
      .then(data => {
        setQuestData(data);
      })
      .catch(() => setQuestData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCompleteMilestone = async (milestoneId: string) => {
    setCompletingId(milestoneId);
    const success = await completeMilestone(milestoneId, []); // evidence can be added later
    if (success) {
      await refreshQuest();
    } else {
      alert('Failed to complete milestone');
    }
    setCompletingId(null);
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: colors.text.muted }}>
        Loading quest…
      </div>
    );
  }

  if (!questData) {
    return (
      <EmptyState
        title="Quest not found"
        body="This quest doesn't exist or you don't have access to it."
      />
    );
  }

  const quest = questData;
  const milestones = quest.milestones || [];

  if (!id) {
    return (
      <EmptyState
        title="Quest not found"
        body="The quest you're looking for doesn't exist or you don't have access."
      />
    );
  }

  const progress =
    milestones.length > 0
      ? Math.round(
          (milestones.filter(m => m.status === 'completed').length / milestones.length) * 100
        )
      : 0;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: space[8] }}>
        <Link to="/quests" style={{ color: colors.accent, fontSize: fontSize.sm }}>
          ← Back to My Quests
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: space[4], marginTop: space[4] }}>
          <h1
            style={{
              margin: 0,
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              lineHeight: 1.1,
            }}
          >
            {quest.title}
          </h1>
          <div
            style={{
              background: quest.status === 'active' ? colors.accentMuted : colors.border,
              color: quest.status === 'active' ? colors.accent : colors.text.muted,
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {quest.status}
          </div>
        </div>

        <div style={{ color: colors.text.muted, marginTop: space[2] }}>
          {quest.timeframe_days} days • Target: {quest.target_scene_tags.join(' • ')}
        </div>

        {/* NFT fan backing CTA — owner only, active quests */}
        {profile?.id === quest.owner_id && quest.status === 'active' && (
          <div style={{ marginTop: space[4] }}>
            <button
              onClick={() => setShowNftModal(true)}
              style={{
                background: 'rgba(240,192,64,0.08)',
                border: '1px solid rgba(240,192,64,0.2)',
                borderRadius: 6,
                color: '#f0c040',
                fontSize: fontSize.sm,
                padding: '7px 14px',
                cursor: 'pointer',
              }}
            >
              🪙 Enable fan backing for this quest
            </button>
          </div>
        )}
      </div>

      {/* NFT Modal */}
      {questData && (
        <NftMintModal
          isOpen={showNftModal}
          onClose={() => setShowNftModal(false)}
          sourceType="quest"
          sourceId={quest.id}
          defaultConfig={{
            name: `${quest.title} — Backer Pass`,
            description: `Back this quest: ${quest.title}`,
            soulbound: false,
            max_supply: 20,
          }}
        />
      )}

      {/* Momentum + Progress */}
      <HiveCard tone="glow" style={{ marginBottom: space[8] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>CURRENT MOMENTUM</div>
            <div style={{ fontSize: 42, fontWeight: fontWeight.bold, lineHeight: 1 }}>
              {quest.momentum}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>PROGRESS</div>
            <div style={{ fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold }}>
              {progress}%
            </div>
            <div style={{ fontSize: fontSize.sm }}>
              {milestones.filter(m => m.status === 'completed').length} / {milestones.length}{' '}
              milestones
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 6,
            background: colors.border,
            borderRadius: 999,
            marginTop: space[4],
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: colors.accent,
              transition: 'width 400ms ease',
            }}
          />
        </div>
      </HiveCard>

      {/* Narrative Summary */}
      <HiveCard style={{ marginBottom: space[8] }}>
        <div style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: space[2] }}>
          NARRATIVE SUMMARY
        </div>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          {quest.description ||
            "You're building real traction in the Brussels underground. Recent performances and targeted submissions are creating momentum. Focus on consistent local presence and one high-signal collaboration."}
        </p>
        <div style={{ fontSize: fontSize.xs, color: colors.text.faint, marginTop: space[3] }}>
          Last updated by Scene Orbit agent • 2 days ago
        </div>
      </HiveCard>

      {/* Milestones */}
      <div style={{ marginBottom: space[8] }}>
        <h2 style={{ fontSize: fontSize.xl, marginBottom: space[4] }}>Milestones</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          {milestones.map((m, index) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                gap: space[4],
                padding: space[4],
                background: m.status === 'completed' ? 'rgba(108, 204, 108, 0.08)' : colors.surface,
                border: `1px solid ${m.status === 'completed' ? 'rgba(108, 204, 108, 0.3)' : colors.border}`,
                borderRadius: radius.lg,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  width: 32,
                  textAlign: 'center',
                  opacity: m.status === 'completed' ? 1 : 0.6,
                }}
              >
                {m.status === 'completed' ? '✓' : index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: fontWeight.medium }}>{m.title}</div>
                {m.completed_at && (
                  <div style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 }}>
                    Completed {new Date(m.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div style={{ fontSize: fontSize.sm, color: colors.text.muted, alignSelf: 'center' }}>
                {m.status.replace('_', ' ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Best Actions */}
      <div style={{ marginBottom: space[8] }}>
        <h2 style={{ fontSize: fontSize.xl, marginBottom: space[4] }}>Next Best Actions</h2>
        <div
          style={{
            display: 'grid',
            gap: space[4],
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          }}
        >
          {actions.map(action => (
            <HiveCard key={action.id} interactive tone="panel">
              <div style={{ fontWeight: fontWeight.semibold, marginBottom: space[2] }}>
                {action.title}
              </div>
              <div
                style={{
                  fontSize: fontSize.sm,
                  color: colors.text.secondary,
                  marginBottom: space[4],
                }}
              >
                {action.rationale}
              </div>
              <div style={{ display: 'flex', gap: space[3], alignItems: 'center' }}>
                <HiveButton size="sm" variant="primary">
                  Take Action
                </HiveButton>
                <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                  {Math.round(action.confidence * 100)}% confidence
                </div>
              </div>
            </HiveCard>
          ))}
        </div>
      </div>

      {/* Quest Log */}
      <HiveCard>
        <h3 style={{ marginTop: 0, marginBottom: space[4] }}>Quest Log</h3>
        <div style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>
          {log.map((entry, i) => (
            <div
              key={i}
              style={{
                marginBottom: space[3],
                paddingLeft: space[2],
                borderLeft: `3px solid ${colors.accentMuted}`,
              }}
            >
              <span style={{ color: colors.text.muted }}>{entry.date} — </span>
              {entry.text}
            </div>
          ))}
        </div>
      </HiveCard>

      <div
        style={{
          marginTop: space[10],
          textAlign: 'center',
          fontSize: fontSize.sm,
          color: colors.text.faint,
        }}
      >
        This is a prototype view. Real data + agent proposals will appear here once the backend is
        wired.
      </div>
    </div>
  );
}
