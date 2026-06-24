import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, Link } from 'react-router-dom';
import { colors, fontSize, fontWeight, radius, space, withAlpha } from '../styles/tokens';
import { HiveCard } from '../components/hive/HiveCard';
import { HiveButton } from '../components/hive/HiveButton';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { ErrorComponent } from '../components/ErrorComponent';
import { NftMintModal } from '../components/NftMintModal';
import { OutcomeLinkModal } from '../components/OutcomeLinkModal';
import { getQuestDetail, createQuestMilestone } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { QuestWithMilestones } from '../lib/types';

export function QuestDetail() {
  const t = useTranslations('quests');
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [questData, setQuestData] = useState<QuestWithMilestones | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [outcomeMilestoneId, setOutcomeMilestoneId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showNftModal, setShowNftModal] = useState(false);
  const [newMilestone, setNewMilestone] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);

  const refreshQuest = async () => {
    if (!id) return;
    const data = await getQuestDetail(id);
    setQuestData(data);
  };

  const load = React.useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    getQuestDetail(id)
      .then(data => {
        if (data) setQuestData(data);
        else setLoadError(true);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMilestone.trim()) return;
    setAddingMilestone(true);
    setActionError(null);
    const ok = await createQuestMilestone(id, newMilestone);
    if (ok) {
      setNewMilestone('');
      await refreshQuest();
    } else {
      setActionError('Could not add the milestone. Please try again.');
    }
    setAddingMilestone(false);
  };

  if (loading) {
    return (
      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: '32px 16px',
          display: 'grid',
          gap: space[4],
        }}
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (loadError || !questData) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px' }}>
        <Link to="/quests" style={{ color: colors.accent, fontSize: fontSize.sm }}>
          ← Back to My Quests
        </Link>
        <ErrorComponent
          message="This quest doesn't exist, was removed, or you don't have access to it."
          onRetry={load}
        />
      </div>
    );
  }

  const quest = questData;
  const milestones = quest.milestones || [];
  const isOwner = profile?.id === quest.owner_id;
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const progress =
    milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: space[8] }}>
        <Link to="/quests" style={{ color: colors.accent, fontSize: fontSize.sm }}>
          ← Back to My Quests
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[4],
            marginTop: space[4],
            flexWrap: 'wrap',
          }}
        >
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
              background:
                quest.status === 'completed'
                  ? withAlpha(colors.success, 0.18)
                  : quest.status === 'active'
                    ? colors.accentMuted
                    : colors.border,
              color:
                quest.status === 'completed'
                  ? colors.success
                  : quest.status === 'active'
                    ? colors.accent
                    : colors.text.muted,
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
          {quest.timeframe_days ? `${quest.timeframe_days} days • ` : ''}
          {quest.target_scene_tags?.length
            ? `Target: ${quest.target_scene_tags.join(' • ')}`
            : 'No target tags'}
        </div>

        {isOwner && quest.status === 'active' && (
          <div style={{ marginTop: space[4] }}>
            <button
              onClick={() => setShowNftModal(true)}
              style={{
                background: colors.accentFaint,
                border: `1px solid ${colors.accentMuted}`,
                borderRadius: radius.md,
                color: colors.accent,
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

      {outcomeMilestoneId && (
        <OutcomeLinkModal
          milestoneId={outcomeMilestoneId}
          onClose={() => setOutcomeMilestoneId(null)}
          onDone={() => {
            setOutcomeMilestoneId(null);
            void refreshQuest();
          }}
        />
      )}

      {/* Momentum + Progress */}
      <HiveCard tone="glow" style={{ marginBottom: space[8] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
              {t('currentMomentum')}
            </div>
            <div style={{ fontSize: 42, fontWeight: fontWeight.bold, lineHeight: 1 }}>
              {quest.momentum}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>{t('progress')}</div>
            <div style={{ fontSize: fontSize['2xl'], fontWeight: fontWeight.semibold }}>
              {progress}%
            </div>
            <div style={{ fontSize: fontSize.sm }}>
              {completedCount} / {milestones.length} milestones
            </div>
          </div>
        </div>
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

      {/* Description */}
      {quest.description && (
        <HiveCard style={{ marginBottom: space[8] }}>
          <div style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: space[2] }}>
            {t('aboutQuest')}
          </div>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{quest.description}</p>
        </HiveCard>
      )}

      {/* Milestones */}
      <div style={{ marginBottom: space[8] }}>
        <h2 style={{ fontSize: fontSize.xl, marginBottom: space[4] }}>{t('milestones')}</h2>

        {actionError && (
          <div style={{ color: colors.danger, fontSize: fontSize.sm, marginBottom: space[4] }}>
            {actionError}
          </div>
        )}

        {milestones.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={t('noMilestones')}
            body={
              isOwner
                ? 'Break this quest into concrete steps below — completing them builds momentum.'
                : 'The quest owner hasn’t added any steps yet.'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
            {milestones.map((m, index) => {
              const done = m.status === 'completed';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    gap: space[4],
                    padding: space[4],
                    alignItems: 'center',
                    background: done ? 'rgba(108, 204, 108, 0.08)' : colors.surface,
                    border: `1px solid ${done ? 'rgba(108, 204, 108, 0.3)' : colors.border}`,
                    borderRadius: radius.lg,
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      width: 32,
                      textAlign: 'center',
                      opacity: done ? 1 : 0.6,
                    }}
                  >
                    {done ? '✓' : index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: fontWeight.medium }}>{m.title}</div>
                    {m.completed_at && (
                      <div
                        style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 }}
                      >
                        Completed {new Date(m.completed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {done ? (
                    <span
                      style={{ fontSize: fontSize.sm, color: colors.success, alignSelf: 'center' }}
                    >
                      {t('done')}
                    </span>
                  ) : isOwner ? (
                    <HiveButton
                      size="sm"
                      variant="primary"
                      onClick={() => setOutcomeMilestoneId(m.id)}
                    >
                      {t('markComplete')}
                    </HiveButton>
                  ) : (
                    <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
                      {m.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add milestone — owner only */}
        {isOwner && quest.status !== 'completed' && (
          <form
            onSubmit={handleAddMilestone}
            style={{ display: 'flex', gap: space[3], marginTop: space[5] }}
          >
            <input
              value={newMilestone}
              onChange={e => setNewMilestone(e.target.value)}
              placeholder={t('addMilestonePlaceholder')}
              maxLength={120}
              style={{
                flex: 1,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                color: colors.text.primary,
                padding: '10px 14px',
                fontSize: fontSize.base,
              }}
            />
            <HiveButton
              type="submit"
              variant="ghost"
              disabled={addingMilestone || !newMilestone.trim()}
            >
              {addingMilestone ? 'Adding…' : 'Add'}
            </HiveButton>
          </form>
        )}
      </div>
    </div>
  );
}
