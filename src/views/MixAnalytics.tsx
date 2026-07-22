import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { colors } from '../styles/tokens';
import { useAuth } from '../hooks/useAuth';
import { getMix, getMixAnalytics } from '../lib/api';
import type { Mix, MixAnalytics as MixAnalyticsType } from '../lib/types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function MixAnalytics() {
  const t = useTranslations('mixAnalytics');
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [mix, setMix] = useState<Mix | null>(null);
  const [analytics, setAnalytics] = useState<MixAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getMix(id), getMixAnalytics(id)]).then(([m, a]) => {
      if (!m) {
        setError('Mix not found');
        setLoading(false);
        return;
      }
      if (!user || m.dj_id !== user.id) {
        setError('Unauthorized');
        setLoading(false);
        return;
      }
      setMix(m);
      setAnalytics(a);
      setLoading(false);
    });
  }, [id, user]);

  if (loading)
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  if (error)
    return <div style={{ textAlign: 'center', padding: 40, color: colors.danger }}>{error}</div>;
  if (!mix || !analytics) return null;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 80px' }}>
      <Link
        to={`/mix/${mix.id}`}
        style={{
          color: colors.text.muted,
          fontSize: 13,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 16,
        }}
      >
        ← Back to mix
      </Link>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        {mix.artwork_url && (
          <img
            src={mix.artwork_url}
            alt={mix.title}
            style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }}
          />
        )}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text.primary, margin: 0 }}>
            {mix.title}
          </h1>
          <p style={{ fontSize: 13, color: colors.text.muted, margin: '4px 0 0' }}>{t('title')}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: t('plays'), value: analytics.totalPlays },
          { label: t('likes'), value: analytics.totalLikes },
          { label: t('comments'), value: analytics.totalComments },
          { label: t('shares'), value: analytics.totalShares },
          { label: t('engagementRate'), value: `${Math.round(analytics.engagementRate * 100)}%` },
          { label: t('completionRate'), value: `${Math.round(analytics.completionRate * 100)}%` },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              padding: 16,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.accent }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: colors.text.muted, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Plays over time */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.text.secondary, marginBottom: 12 }}>
        {t('playsOverTime')}
      </h3>
      <div
        style={{
          padding: 16,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          marginBottom: 24,
          minHeight: 120,
        }}
      >
        {analytics.playsByDay.length === 0 ? (
          <p style={{ color: colors.text.muted, fontSize: 13, textAlign: 'center', margin: 20 }}>
            No play data yet
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 4,
              height: 100,
              padding: '0 4px',
            }}
          >
            {analytics.playsByDay.slice(-14).map(day => {
              const max = Math.max(...analytics.playsByDay.map(d => d.count), 1);
              const height = (day.count / max) * 100;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count} plays`}
                  style={{
                    flex: 1,
                    height: `${height}%`,
                    background: colors.accent,
                    borderRadius: '4px 4px 0 0',
                    minHeight: 4,
                    opacity: 0.7 + (height / 100) * 0.3,
                  }}
                />
              );
            })}
          </div>
        )}
        {analytics.playsByDay.length > 0 && (
          <div
            style={{ fontSize: 11, color: colors.text.faintest, textAlign: 'center', marginTop: 8 }}
          >
            Last {Math.min(analytics.playsByDay.length, 14)} days
          </div>
        )}
      </div>

      {/* Top referrers */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.text.secondary, marginBottom: 12 }}>
        {t('topReferrers')}
      </h3>
      <div
        style={{
          padding: 16,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          marginBottom: 24,
        }}
      >
        {analytics.topReferrers.length === 0 ? (
          <p style={{ color: colors.text.muted, fontSize: 13, textAlign: 'center', margin: 20 }}>
            No referral data yet
          </p>
        ) : (
          analytics.topReferrers.slice(0, 5).map(ref => (
            <div
              key={ref.source}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <span style={{ color: colors.text.secondary, fontSize: 13 }}>{ref.source}</span>
              <span style={{ color: colors.accent, fontWeight: 600, fontSize: 13 }}>
                {ref.count}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Geographic distribution */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.text.secondary, marginBottom: 12 }}>
        {t('geoDistribution')}
      </h3>
      <div
        style={{
          padding: 16,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
        }}
      >
        {analytics.geoDistribution.length === 0 ? (
          <p style={{ color: colors.text.muted, fontSize: 13, textAlign: 'center', margin: 20 }}>
            No geographic data yet
          </p>
        ) : (
          analytics.geoDistribution.slice(0, 5).map(geo => (
            <div
              key={geo.country}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <span style={{ color: colors.text.secondary, fontSize: 13 }}>{geo.country}</span>
              <span style={{ color: colors.accent, fontWeight: 600, fontSize: 13 }}>
                {geo.count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
