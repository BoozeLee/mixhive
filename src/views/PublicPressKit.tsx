import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PressKit } from '../lib/types';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';

export function PublicPressKit() {
  const t = useTranslations('publicPressKit');
  const { slug } = useParams();
  const [kit, setKit] = useState<PressKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    fetch(`/api/epk/${slug}`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Press kit not found');
        return body.press_kit as PressKit;
      })
      .then(data => {
        if (alive) setKit(data);
      })
      .catch(err => {
        if (alive) setError(err instanceof Error ? err.message : 'Press kit not found');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div
        style={{ maxWidth: 880, margin: '0 auto', padding: space[10], color: colors.text.muted }}
      >
        {t('loadingEpk')}
      </div>
    );
  }

  if (error || !kit) {
    return (
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: space[10],
          color: colors.text.muted,
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: colors.text.primary }}>{t('epkNotFound')}</h1>
        <p>{error || 'This press kit is private or unavailable.'}</p>
        <Link to="/" style={{ color: colors.accent }}>
          {t('backToMixhive')}
        </Link>
      </div>
    );
  }

  const content = kit.content;
  return (
    <article
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: `${space[9]}px ${space[8]}px ${space[12]}px`,
      }}
    >
      <section
        style={{
          border: `1px solid ${colors.accentMuted}`,
          borderRadius: radius.xl,
          overflow: 'hidden',
          background: 'rgba(7,7,5,0.9)',
        }}
      >
        <div
          style={{
            padding: `clamp(${space[8]}px, 7vw, ${space[12]}px)`,
            background: 'linear-gradient(135deg, rgba(240,192,64,0.2), rgba(7,7,5,0.3))',
          }}
        >
          <div style={{ display: 'flex', gap: space[7], alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                width: 112,
                height: 112,
                borderRadius: '50%',
                background: content.avatar_url
                  ? `url(${content.avatar_url}) center/cover`
                  : colors.surface,
                border: `1px solid ${colors.accent}`,
                boxShadow: '0 0 32px rgba(240,192,64,0.24)',
              }}
            />
            <div>
              <p
                style={{
                  margin: `0 0 ${space[2]}px`,
                  color: colors.accent,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {t('mixhiveElectronicPressKit')}
              </p>
              <h1
                style={{
                  margin: 0,
                  color: colors.text.primary,
                  fontSize: 'clamp(36px, 8vw, 72px)',
                  lineHeight: 0.95,
                }}
              >
                {content.artist_name}
              </h1>
              <p style={{ margin: `${space[4]}px 0 0`, color: colors.text.secondary }}>
                {[content.location, content.genres.slice(0, 5).join(' / ')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: `clamp(${space[7]}px, 5vw, ${space[10]}px)`,
            display: 'grid',
            gap: space[8],
          }}
        >
          <Block title={t('bookingPitch')}>{content.booking_pitch}</Block>
          {content.bio && <Block title={t('bio')}>{content.bio}</Block>}
          {content.custom_sections &&
            content.custom_sections.length > 0 &&
            content.custom_sections.map((section, i) =>
              section.heading && section.body ? (
                <Block key={i} title={section.heading}>
                  {section.body}
                </Block>
              ) : null
            )}
          <section>
            <h2 style={titleStyle}>{t('featuredMixes')}</h2>
            {content.top_mixes.length === 0 ? (
              <p style={bodyStyle}>{t('noPublishedMixhiveMixes')}</p>
            ) : (
              <div style={{ display: 'grid', gap: space[4] }}>
                {content.top_mixes.map(mix => (
                  <Link
                    key={mix.id}
                    to={mix.url_path}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: space[4],
                      textDecoration: 'none',
                      color: colors.text.secondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      padding: space[5],
                    }}
                  >
                    <strong style={{ color: colors.text.primary }}>{mix.title}</strong>
                    <span style={{ color: colors.text.dim, fontSize: fontSize.xs }}>
                      {mix.play_count} plays
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <footer
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: space[5],
              flexWrap: 'wrap',
              borderTop: `1px solid ${colors.border}`,
              paddingTop: space[7],
              color: colors.text.dim,
              fontSize: fontSize.xs,
            }}
          >
            <span>{t('generatedFromVerifiedMixhive')}</span>
            <Link
              to="/"
              style={{ color: colors.accent, textDecoration: 'none', fontWeight: fontWeight.bold }}
            >
              mixhive.app
            </Link>
          </footer>
        </div>
      </section>
    </article>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={titleStyle}>{title}</h2>
      <p style={bodyStyle}>{children}</p>
    </section>
  );
}

const titleStyle: CSSProperties = {
  margin: `0 0 ${space[3]}px`,
  color: colors.accent,
  fontSize: fontSize.xs,
  fontWeight: fontWeight.bold,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: colors.text.secondary,
  fontSize: fontSize.base,
  lineHeight: 1.75,
};
