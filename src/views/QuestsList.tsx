import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, fontSize, fontWeight, space } from '../styles/tokens';
import { HiveCard } from '../components/hive/HiveCard';
import { HiveButton } from '../components/hive/HiveButton';
import { EmptyState } from '../components/EmptyState';
import { getActiveQuests, getQuestMilestoneCounts } from '../lib/api';
import { CreateQuestModal } from '../components/CreateQuestModal';
import { GraphSeedingModal } from '../components/GraphSeedingModal';
import { ProposalsInbox } from '../components/ProposalsInbox';
import type { MythicQuest } from '../lib/types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface QuestSummary {
  id: string;
  title: string;
  momentum: number;
  completedMilestones: number;
  totalMilestones: number;
  lastActivity: string;
  targetTags: string[];
  status: 'active' | 'paused' | 'completed' | 'abandoned';
}

export function QuestsList() {
  const t = useTranslations('quests');
  const { user } = useAuth();
  const [quests, setQuests] = useState<QuestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSeedingModal, setShowSeedingModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    getActiveQuests(user.id)
      .then(async (data: MythicQuest[]) => {
        const ids = data.map(q => q.id);
        const counts = await getQuestMilestoneCounts(ids);
        const formatted: QuestSummary[] = data.map(q => ({
          id: q.id,
          title: q.title,
          momentum: q.momentum,
          completedMilestones: counts[q.id]?.completed ?? 0,
          totalMilestones: counts[q.id]?.total ?? 0,
          lastActivity: new Date(q.updated_at).toLocaleDateString(),
          targetTags: q.target_scene_tags,
          status: q.status,
        }));
        setQuests(formatted);
      })
      .catch(() => setQuests([]))
      .finally(() => setLoading(false));
  }, [user]);

  const activeQuests = quests.filter(q => q.status === 'active');
  const completedQuests = quests.filter(q => q.status === 'completed');

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>
      <header style={{ marginBottom: space[8] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }}>
            {t('myQuests')}
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <HiveButton variant="secondary" onClick={() => setShowSeedingModal(true)}>
              {t('seedGraph')}
            </HiveButton>
            <HiveButton variant="primary" onClick={() => setShowCreateModal(true)}>
              + New Quest
            </HiveButton>
          </div>
        </div>
        <p style={{ color: colors.text.muted, marginTop: space[2] }}>{t('mythicSubtitle')}</p>
      </header>

      <ProposalsInbox />

      {/* Active Quests */}
      <section style={{ marginBottom: space[10] }}>
        <h2 style={{ fontSize: fontSize.xl, marginBottom: space[4] }}>{t('active')}</h2>
        {activeQuests.length === 0 ? (
          <EmptyState
            icon="🧭"
            title={t('noActiveQuests')}
            body="Start a new quest or let one of your Mythic agents propose one for you."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gap: space[4],
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            }}
          >
            {activeQuests.map(quest => (
              <Link
                key={quest.id}
                to={`/quests/${quest.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <HiveCard interactive tone="panel">
                  <div
                    style={{
                      fontWeight: fontWeight.semibold,
                      marginBottom: space[2],
                      lineHeight: 1.3,
                    }}
                  >
                    {quest.title}
                  </div>
                  <div
                    style={{
                      fontSize: fontSize.sm,
                      color: colors.text.muted,
                      marginBottom: space[4],
                    }}
                  >
                    {quest.targetTags.join(' • ')}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: fontSize.sm,
                      marginBottom: space[2],
                    }}
                  >
                    <div>{t('momentum')}</div>
                    <div style={{ fontWeight: fontWeight.medium }}>{quest.momentum}</div>
                  </div>

                  <div
                    style={{
                      height: 4,
                      background: colors.border,
                      borderRadius: 999,
                      marginBottom: space[4],
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round((quest.completedMilestones / quest.totalMilestones) * 100)}%`,
                        height: '100%',
                        background: colors.accent,
                        borderRadius: 999,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.text.faint,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      {quest.completedMilestones} / {quest.totalMilestones} milestones
                    </span>
                    <span>Last activity {quest.lastActivity}</span>
                  </div>
                </HiveCard>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Completed / Archived */}
      {completedQuests.length > 0 && (
        <section>
          <h2 style={{ fontSize: fontSize.xl, marginBottom: space[4] }}>{t('completed')}</h2>
          <div
            style={{
              display: 'grid',
              gap: space[4],
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            }}
          >
            {completedQuests.map(quest => (
              <Link
                key={quest.id}
                to={`/quests/${quest.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <HiveCard tone="flat">
                  <div style={{ fontWeight: fontWeight.medium, marginBottom: space[2] }}>
                    {quest.title}
                  </div>
                  <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
                    Completed • {quest.targetTags.join(' • ')}
                  </div>
                </HiveCard>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showCreateModal && (
        <CreateQuestModal
          onClose={() => setShowCreateModal(false)}
          onCreated={_newQuest => {
            // Refresh the list after creation
            getActiveQuests(user!.id).then(data => {
              const formatted = data.map((q: MythicQuest) => ({
                id: q.id,
                title: q.title,
                momentum: q.momentum,
                completedMilestones: 0,
                totalMilestones: 4,
                lastActivity: new Date(q.updated_at).toLocaleDateString(),
                targetTags: q.target_scene_tags,
                status: q.status,
              }));
              setQuests(formatted);
            });
          }}
        />
      )}

      {showSeedingModal && (
        <GraphSeedingModal
          onClose={() => setShowSeedingModal(false)}
          onSeeded={() => {
            // Optionally refresh quests or show a success toast
            console.log('Graph seeded — user should now have more data for quests');
          }}
        />
      )}
    </div>
  );
}
