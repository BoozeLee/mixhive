import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { getMixesByDj, getProfileAnalytics, getUserActivity } from '../lib/api';
import { listAgents, type LuaAgent } from '../lib/agents';
import { useAuth } from '../hooks/useAuth';
import { HiveCard, HiveStat, WaveBar } from '../components/hive';
import { SkeletonFeed } from '../components/Skeleton';
import { ProfileCoachPanel } from '../components/ProfileCoachPanel';
import { CreatorRecap } from '../components/CreatorRecap';
import { YieldForensicsPanel } from '../components/YieldForensicsPanel';
import { ContentPerformance } from '../components/ContentPerformance';
import type { ActivityEvent, Mix, ProfileAnalytics } from '../lib/types';
import { colors, radius, space } from '../styles/tokens';

export function Dashboard() {
  const t = useTranslations('dashboard');
  const { user, profile } = useAuth();

  function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (!Number.isFinite(diff)) return '';
    if (diff < 60) return t('time.justNow');
    if (diff < 3600) return t('time.minutes', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('time.hours', { n: Math.floor(diff / 3600) });
    if (diff < 2592000) return t('time.days', { n: Math.floor(diff / 86400) });
    return t('time.months', { n: Math.floor(diff / 2592000) });
  }

  function activityLabel(event: ActivityEvent) {
    if (event.activity_type === 'upload')
      return t('activity.uploaded', { title: event.mix_title || t('activity.aMix') });
    if (event.activity_type === 'like')
      return t('activity.liked', { title: event.mix_title || t('activity.aMix') });
    return t('activity.followed', {
      name: event.target_display_name || event.target_username || t('activity.aCreator'),
    });
  }

  const [mixes, setMixes] = useState<Mix[]>([]);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [agents, setAgents] = useState<LuaAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const nextMixes = await getMixesByDj(user!.id);
      const [nextAnalytics, nextActivity, nextAgents] = await Promise.all([
        getProfileAnalytics(user!.id, nextMixes),
        getUserActivity(user!.id),
        listAgents().catch(() => [] as LuaAgent[]),
      ]);
      if (cancelled) return;
      setMixes(nextMixes);
      setAnalytics(nextAnalytics);
      setActivity(nextActivity);
      setAgents(nextAgents);
      setLoading(false);
    }

    void load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const nextActions = useMemo(() => {
    const actions = [
      {
        title: t('actions.upload.title'),
        body: mixes.length === 0 ? t('actions.upload.bodyEmpty') : t('actions.upload.bodyActive'),
        to: '/upload',
        cta: t('actions.upload.cta'),
      },
      {
        title: t('actions.profile.title'),
        body: profile?.bio ? t('actions.profile.bodyWithBio') : t('actions.profile.bodyNoBio'),
        to: profile?.username ? `/u/${profile.username}` : '/settings',
        cta: t('actions.profile.cta'),
      },
      {
        title: t('actions.epk.title'),
        body: t('actions.epk.body'),
        to: '/epk',
        cta: t('actions.epk.cta'),
      },
      {
        title: t('actions.opportunities.title'),
        body: t('actions.opportunities.body'),
        to: '/opportunities',
        cta: t('actions.opportunities.cta'),
      },
    ];
    return actions;
  }, [mixes.length, profile?.bio, profile?.username, t]);

  const topMix = analytics?.topMixes[0];
  const sparkline = analytics?.weeklyEvents.map(item => item.count) ?? [0, 0, 0, 0, 0, 0];

  if (loading) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px 112px' }}>
        <SkeletonFeed />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px 112px' }}>
      <header
        className="hive-panel"
        style={{
          borderRadius: radius.lg,
          padding: 'clamp(22px, 4vw, 42px)',
          marginBottom: space[10],
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720 }}>
          <p
            style={{
              margin: '0 0 8px',
              color: 'var(--hive-gold)',
              fontSize: 12,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            {t('title')}
          </p>
          <h1
            style={{
              margin: 0,
              color: colors.text.primary,
              fontSize: 'clamp(30px, 6vw, 58px)',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {t('commandCell', {
              name: profile?.display_name || profile?.username || t('creatorFallback'),
            })}
          </h1>
          <p
            style={{
              margin: '16px 0 0',
              color: colors.text.secondary,
              fontSize: 16,
              lineHeight: 1.7,
            }}
          >
            {t('subtitle')}
          </p>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: space[6],
          marginBottom: space[10],
        }}
      >
        <HiveCard>
          <HiveStat
            label={t('stats.plays')}
            value={analytics?.totalPlays ?? 0}
            sparkline={sparkline}
          />
        </HiveCard>
        <HiveCard>
          <HiveStat label={t('stats.likes')} value={analytics?.totalLikes ?? 0} />
        </HiveCard>
        <HiveCard>
          <HiveStat label={t('stats.comments')} value={analytics?.totalComments ?? 0} />
        </HiveCard>
        <HiveCard>
          <HiveStat label={t('stats.followers')} value={analytics?.followers ?? 0} />
        </HiveCard>
      </section>

      <CreatorRecap />

      <YieldForensicsPanel />

      <section style={{ marginBottom: space[10] }}>
        <ProfileCoachPanel compact />
      </section>

      <ContentPerformance mixes={mixes} genres={analytics?.genreDistribution ?? []} />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, 0.75fr)',
          gap: space[8],
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: space[8] }}>
          <HiveCard tone="glow">
            <h2 style={{ margin: '0 0 14px', color: colors.text.primary, fontSize: 20 }}>
              {t('topSignal')}
            </h2>
            {topMix ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '86px minmax(0, 1fr)',
                  gap: space[8],
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 86,
                    aspectRatio: '1',
                    borderRadius: radius.lg,
                    background: topMix.artwork_url
                      ? `url(${topMix.artwork_url}) center/cover`
                      : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})`,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <Link
                    to={`/mix/${topMix.id}`}
                    style={{
                      color: colors.text.primary,
                      fontSize: 18,
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    {topMix.title}
                  </Link>
                  <p style={{ margin: '8px 0 0', color: colors.text.muted, fontSize: 13 }}>
                    {t('topMixStats', {
                      plays: topMix.play_count ?? 0,
                      likes: topMix.like_count ?? 0,
                      comments: topMix.comment_count ?? 0,
                    })}
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <WaveBar
                      peaks={sparkline.length ? sparkline : [0, 0, 0, 0, 0, 0]}
                      height={34}
                      label="Weekly activity"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, color: colors.text.muted }}>{t('topMixEmpty')}</p>
            )}
          </HiveCard>

          <HiveCard>
            <h2 style={{ margin: '0 0 14px', color: colors.text.primary, fontSize: 20 }}>
              {t('recentActivity')}
            </h2>
            {activity.length === 0 ? (
              <p style={{ margin: 0, color: colors.text.muted }}>{t('recentActivityEmpty')}</p>
            ) : (
              <div style={{ display: 'grid', gap: space[4] }}>
                {activity.slice(0, 8).map((event, index) => (
                  <div
                    key={`${event.created_at}-${index}`}
                    style={{
                      display: 'flex',
                      gap: space[4],
                      alignItems: 'center',
                      padding: space[5],
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      background: colors.surface,
                    }}
                  >
                    <span aria-hidden="true" style={{ color: colors.accent }}>
                      ◆
                    </span>
                    <span style={{ flex: 1, color: colors.text.secondary, fontSize: 13 }}>
                      {activityLabel(event)}
                    </span>
                    <span style={{ color: colors.text.dim, fontSize: 12 }}>
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </HiveCard>
        </div>

        <aside style={{ display: 'grid', gap: space[8] }}>
          <HiveCard>
            <h2 style={{ margin: '0 0 14px', color: colors.text.primary, fontSize: 20 }}>
              {t('nextActions')}
            </h2>
            <div style={{ display: 'grid', gap: space[5] }}>
              {nextActions.map(action => (
                <Link
                  key={action.title}
                  to={action.to}
                  style={{
                    display: 'block',
                    padding: space[6],
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    background: colors.surface,
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  <strong style={{ display: 'block', color: colors.text.primary, fontSize: 14 }}>
                    {action.title}
                  </strong>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 5,
                      color: colors.text.muted,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {action.body}
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 10,
                      color: colors.accent,
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    {action.cta}
                  </span>
                </Link>
              ))}
            </div>
          </HiveCard>

          <HiveCard>
            <h2 style={{ margin: '0 0 14px', color: colors.text.primary, fontSize: 20 }}>
              {t('automationBees')}
            </h2>
            <p
              style={{
                margin: '0 0 14px',
                color: colors.text.muted,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {agents.length === 0
                ? t('automation.bodyEmpty')
                : t('automation.bodyActive', {
                    active: agents.filter(agent => agent.enabled).length,
                    total: agents.length,
                  })}
            </p>
            <Link
              to={agents.length === 0 ? '/agents/gallery' : '/agents'}
              style={{
                color: colors.accent,
                fontWeight: 800,
                fontSize: 13,
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              {agents.length === 0 ? t('automation.ctaFork') : t('automation.ctaManage')}
            </Link>
          </HiveCard>
        </aside>
      </section>
    </div>
  );
}
