import type { ProfileAnalytics } from '../lib/types';
import { useTranslations } from 'next-intl';
import { Button } from './ui/Button';
import { colors, radius, space } from '../styles/tokens';

interface Props {
  analytics: ProfileAnalytics;
  profileName: string;
}

function metric(value: number | string, label: string) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        padding: space[7],
        minWidth: 0,
      }}
    >
      <div style={{ color: colors.text.primary, fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ color: colors.text.dim, fontSize: 12, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function ProfileAnalyticsDashboard({ analytics, profileName }: Props) {
  const t = useTranslations('profileAnalyticsDashboard');
  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    download(
      `${profileName.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}-analytics.json`,
      JSON.stringify({ profileName, analytics }, null, 2),
      'application/json'
    );
  }

  function exportCsv() {
    const rows = [
      ['metric', 'value'],
      ['total_plays', analytics.totalPlays],
      ['total_likes', analytics.totalLikes],
      ['total_comments', analytics.totalComments],
      ['total_mixes', analytics.totalMixes],
      ['followers', analytics.followers],
      ['following', analytics.following],
      ['average_plays_per_mix', analytics.averagePlaysPerMix],
      ['like_to_play_ratio', analytics.likeToPlayRatio],
      ['follower_engagement_rate', analytics.followerEngagementRate],
      ['upload_frequency_days', analytics.uploadFrequencyDays ?? ''],
    ];
    download(
      `${profileName.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}-analytics.csv`,
      rows.map(row => row.join(',')).join('\n'),
      'text/csv'
    );
  }

  function copyShareCard() {
    const lines = [
      `Honey Drop: ${profileName} on MixHive`,
      `${analytics.totalMixes} mixes | ${analytics.totalPlays} plays | ${analytics.followers} followers`,
      `Avg ${analytics.averagePlaysPerMix} plays/mix | ${analytics.likeToPlayRatio}% like-to-play`,
      typeof window !== 'undefined' ? window.location.href : '',
    ].filter(Boolean);
    void navigator.clipboard?.writeText(lines.join('\n'));
  }

  const maxEvents = Math.max(1, ...analytics.weeklyEvents.map(item => item.count));

  return (
    <section style={{ marginBottom: space[12] }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[6],
          marginBottom: space[6],
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text.primary }}>
          {t('analytics')}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
          <Button type="button" variant="secondary" size="sm" onClick={copyShareCard}>
            {t('shareCard')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={exportCsv}>
            {t('csv')}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={exportJson}>
            {t('json')}
          </Button>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
          gap: space[5],
          marginBottom: space[6],
        }}
      >
        {metric(analytics.totalPlays, 'total plays')}
        {metric(analytics.averagePlaysPerMix, 'avg plays / mix')}
        {metric(`${analytics.likeToPlayRatio}%`, 'like-to-play')}
        {metric(`${analytics.followerEngagementRate}%`, 'follower engagement')}
        {metric(
          analytics.uploadFrequencyDays ? `${analytics.uploadFrequencyDays}d` : 'n/a',
          'upload cadence'
        )}
        {analytics.gearSalesCount !== undefined && (
          <>
            {metric(analytics.gearSalesCount, 'gear sales')}
            {metric(`€${analytics.gearSalesTotal?.toFixed(0) || '0'}`, 'gear revenue')}
          </>
        )}
      </div>
      <div
        style={{
          background: `linear-gradient(135deg, ${colors.accentFaint}, rgba(59,130,246,0.16))`,
          border: `1px solid ${colors.accentMuted}`,
          borderRadius: radius.lg,
          padding: space[7],
          marginBottom: space[6],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[6],
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              color: colors.accent,
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
            }}
          >
            {t('honeyDrop')}
          </div>
          <div style={{ color: colors.text.primary, fontSize: 15, fontWeight: 700, marginTop: 4 }}>
            {analytics.totalPlays >= 1000
              ? 'The hive is moving to this sound.'
              : analytics.totalMixes > 0
                ? 'The first drops are warming up.'
                : 'Ready for the first drop.'}
          </div>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={copyShareCard}>
          {t('copyDrop')}
        </Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: space[6],
        }}
      >
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            padding: space[7],
          }}
        >
          <h3 style={{ margin: '0 0 12px', color: colors.text.secondary, fontSize: 14 }}>
            {t('weeklyActivity')}
          </h3>
          <div style={{ display: 'flex', alignItems: 'end', gap: space[4], height: 90 }}>
            {analytics.weeklyEvents.map(item => (
              <div
                key={item.label}
                style={{ flex: 1, minWidth: 20, display: 'grid', gap: 6, alignItems: 'end' }}
              >
                <div
                  title={`${item.count} events`}
                  style={{
                    height: Math.max(4, (item.count / maxEvents) * 70),
                    background: colors.accent,
                    borderRadius: radius.sm,
                  }}
                />
                <span style={{ color: colors.text.dim, fontSize: 10, textAlign: 'center' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            padding: space[7],
          }}
        >
          <h3 style={{ margin: '0 0 12px', color: colors.text.secondary, fontSize: 14 }}>
            {t('topMixes')}
          </h3>
          {analytics.topMixes.length === 0 ? (
            <p style={{ color: colors.text.dim, fontSize: 13 }}>{t('noMixesYet')}</p>
          ) : (
            analytics.topMixes.map(mix => (
              <div
                key={mix.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: space[5],
                  color: colors.text.secondary,
                  fontSize: 13,
                  padding: '6px 0',
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                }}
              >
                <span
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {mix.title}
                </span>
                <span style={{ color: colors.text.dim }}>{mix.play_count} plays</span>
              </div>
            ))
          )}
        </div>
      </div>
      {analytics.genreDistribution.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4], marginTop: space[6] }}>
          {analytics.genreDistribution.map(genre => (
            <span
              key={genre.name}
              style={{
                background: colors.surfaceHover,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.pill,
                color: colors.text.secondary,
                padding: '5px 10px',
                fontSize: 12,
              }}
            >
              {genre.name} · {genre.count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
