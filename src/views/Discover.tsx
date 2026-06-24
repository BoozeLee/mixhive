import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { getTrending, getAIAgentLeaderboard, type AIAgent } from '../lib/api';
import { getPopularSearches } from '../lib/search';
import { MixCard } from '../components/MixCard';
import { AIAgentCard } from '../components/AIAgentCard';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Reveal } from '../components/ui/Reveal';
import { SkeletonBar } from '../components/Skeleton';
import type { FeedMix } from '../lib/types';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';

export function Discover() {
  const t = useTranslations('discover');
  const [mixes, setMixes] = useState<FeedMix[]>([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTrending(12)
      .then(result => {
        if (!cancelled) setMixes(result.data);
      })
      .catch(error => {
        console.error('Error fetching discover data:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    getAIAgentLeaderboard(6)
      .then(result => { if (!cancelled) setAgents(result); })
      .catch(() => { /* suppress — section stays hidden */ })
      .finally(() => { if (!cancelled) setAgentsLoading(false); });

    return () => {
      cancelled = true;
    };
  }, []);

  const genres = getPopularSearches().slice(0, 10);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 96px' }}>
      <header style={{ marginBottom: space[11] }}>
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
      </header>

      <section style={{ marginBottom: space[12] }}>
        <h2
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            marginBottom: space[6],
            fontFamily: 'var(--font-display, system-ui)',
            letterSpacing: '0.01em',
          }}
        >
          {t('trendingMixes')}
        </h2>
        {loading ? (
          <div style={{ display: 'grid', gap: space[4] }}>
            {[1, 2, 3].map(index => (
              <div
                key={index}
                style={{
                  height: 98,
                  background: colors.surface,
                  borderRadius: radius.lg,
                  border: `1px solid ${colors.border}`,
                }}
              />
            ))}
          </div>
        ) : mixes.length === 0 ? (
          <p style={{ color: colors.text.dim, fontSize: 14 }}>{t('noTrending')}</p>
        ) : (
          <div style={{ display: 'grid', gap: space[4] }}>
            {mixes.map((mix, i) => (
              <Reveal key={mix.id} index={i} from="up">
                <MixCard mix={mix} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {(agentsLoading || agents.length > 0) && (
        <section style={{ marginBottom: space[12] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: space[6],
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: fontSize.xl,
                  fontWeight: fontWeight.bold,
                  color: colors.text.primary,
                  margin: 0,
                  fontFamily: 'var(--font-display, system-ui)',
                  letterSpacing: '0.01em',
                }}
              >
                {t('aiBand')}
              </h2>
              <p style={{ fontSize: fontSize.sm, color: colors.text.dim, margin: `${space[1]}px 0 0` }}>
                {t('aiBandSubtitle')}
              </p>
            </div>
            <Link
              to="/ai-band"
              style={{
                fontSize: fontSize.sm,
                color: colors.accentMuted,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                fontWeight: fontWeight.semibold,
              }}
            >
              See all →
            </Link>
          </div>

          {agentsLoading ? (
            <div
              style={{
                display: 'flex',
                gap: space[5],
                overflowX: 'auto',
                paddingBottom: space[2],
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBar key={i} width={240} height={160} style={{ flexShrink: 0, borderRadius: 12 }} />
              ))}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: space[5],
                overflowX: 'auto',
                paddingBottom: space[2],
              }}
            >
              {agents.map(agent => (
                <div key={agent.id} style={{ flexShrink: 0, width: 240 }}>
                  <AIAgentCard agent={agent} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            marginBottom: space[6],
            fontFamily: 'var(--font-display, system-ui)',
            letterSpacing: '0.01em',
          }}
        >
          {t('popularGenres')}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4] }}>
          {genres.map(genre => (
            <Link
              key={genre}
              to={`/search?q=${encodeURIComponent(genre)}`}
              style={{
                display: 'inline-flex',
                padding: '8px 14px',
                background: colors.surface,
                border: `1px solid ${colors.accentMuted}`,
                borderRadius: radius.pill,
                color: colors.text.secondary,
                textDecoration: 'none',
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.color = colors.accent;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = colors.accentMuted;
                e.currentTarget.style.color = colors.text.secondary;
              }}
            >
              {genre}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
