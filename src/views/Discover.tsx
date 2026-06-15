import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { getTrending } from '../lib/api';
import { getPopularSearches } from '../lib/search';
import { MixCard } from '../components/MixCard';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Reveal } from '../components/ui/Reveal';
import type { FeedMix } from '../lib/types';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';

export function Discover() {
  const t = useTranslations('discover');
  const [mixes, setMixes] = useState<FeedMix[]>([]);
  const [loading, setLoading] = useState(true);

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
