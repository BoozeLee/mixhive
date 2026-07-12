import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'react-router-dom';
import { getAgent, getMixesByAgent } from '../lib/api';
import type { AiAgent, Mix } from '../lib/types';
import { MixCard } from '../components/MixCard';
import { AgentFollowButton } from '../components/AgentFollowButton';
import { EmptyState } from '../components/EmptyState';
import { SkeletonBar } from '../components/Skeleton';
import { colors, gradient, radius, shadow, space } from '../styles/tokens';

// AI agent-artist page: a followable "AI bandmate" with stats + discography.
export function AgentTracks() {
  const t = useTranslations('aiBand');
  const { slug } = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<AiAgent | null>(null);
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [loading, setLoading] = useState(true);
  const [followDelta, setFollowDelta] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setFollowDelta(0);
    Promise.all([getAgent(slug), getMixesByAgent(slug)])
      .then(([a, rows]) => {
        if (cancelled) return;
        setAgent(a);
        setMixes(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const name = agent?.name || slug || 'agent';
  const totalPlays = useMemo(() => mixes.reduce((sum, m) => sum + (m.play_count || 0), 0), [mixes]);
  const followers = (agent?.follower_count || 0) + followDelta;

  const stats: Array<[string, string]> = [
    [followers.toLocaleString(), followers === 1 ? t('follower') : t('followers')],
    [String(mixes.length), mixes.length === 1 ? t('track') : t('tracks')],
    [totalPlays.toLocaleString(), t('plays')],
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 12px 96px' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: space[8],
          marginBottom: space[10],
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: gradient.honey,
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            boxShadow: shadow.honey,
            color: colors.black,
            fontWeight: 900,
            fontSize: 30,
          }}
        >
          {(name[0] || '?').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.4,
              padding: '2px 7px',
              borderRadius: radius.pill,
              background: colors.accentFaint,
              border: `1px solid ${colors.accentMuted}`,
              color: colors.accent,
            }}
            title={t('bandmateTooltip')}
          >
            ✦ {t('bandmate')}
          </span>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, color: colors.text.primary }}>{name}</h1>
          <div style={{ display: 'flex', gap: space[8], marginTop: space[5], flexWrap: 'wrap' }}>
            {stats.map(([value, label]) => (
              <div key={label} style={{ color: colors.text.dim, fontSize: 13 }}>
                <span style={{ color: colors.text.primary, fontWeight: 800 }}>{value}</span> {label}
              </div>
            ))}
          </div>
        </div>
        {slug && <AgentFollowButton slug={slug} onChange={d => setFollowDelta(v => v + d)} />}
      </header>

      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: colors.text.secondary,
          marginBottom: space[6],
        }}
      >
        {t('discography')}
      </h2>

      {loading ? (
        <div style={{ display: 'grid', gap: space[5] }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBar key={i} height={96} />
          ))}
        </div>
      ) : mixes.length === 0 ? (
        <EmptyState
          icon="✦"
          title={t('noTracksTitle')}
          body={t('noTracksBody', { name })}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
          {mixes.map(mix => (
            <MixCard
              key={mix.id}
              mix={{
                ...mix,
                dj_username: mix.dj?.username || '',
                dj_display_name: mix.dj?.display_name || mix.dj?.username || '',
                dj_avatar_url: mix.dj?.avatar_url || '',
                genre_name: mix.genre_name || null,
                weekly_plays: mix.weekly_plays || 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
