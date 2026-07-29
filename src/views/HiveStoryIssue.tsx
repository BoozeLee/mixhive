import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useParams } from 'react-router-dom';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';
import { BeeMark } from '../components/brand/BeeMark';

interface HiveStoryIssueData {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  theme_color: string;
  hero_image_url?: string;
  published_at: string;
}

interface HiveStoryProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  genres?: string[];
}

interface HiveStoryMix {
  id: string;
  title: string;
  cover_url?: string;
  genre?: string;
}

interface HiveStoryFeature {
  id: string;
  feature_type: 'artist' | 'mix' | 'collab' | 'scene';
  headline: string;
  body_text?: string;
  order_position: number;
  profile_id?: string;
  mix_id?: string;
  profile?: HiveStoryProfile;
  mix?: HiveStoryMix;
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function FeatureCard({
  feature,
  themeColor,
  typeLabel,
  listenLabel,
}: {
  feature: HiveStoryFeature;
  themeColor: string;
  typeLabel: string;
  listenLabel: string;
}) {
  const { profile, mix } = feature;
  const coverUrl = mix?.cover_url ?? profile?.avatar_url;

  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: coverUrl ? '80px 1fr' : '1fr',
        gap: space[6],
        padding: `${space[7]}px`,
        borderRadius: radius.lg,
        border: `1px solid ${themeColor}22`,
        background: 'rgba(12,12,8,0.7)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${themeColor}55`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${themeColor}22`;
      }}
    >
      {coverUrl && (
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: feature.feature_type === 'artist' ? '50%' : radius.md,
            background: `url(${coverUrl}) center/cover no-repeat, ${themeColor}18`,
            border: `1px solid ${themeColor}44`,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: fontSize.xs,
            color: themeColor,
            fontWeight: fontWeight.semibold,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: space[1],
          }}
        >
          {typeLabel}
        </div>
        <h3
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            margin: 0,
          }}
        >
          {feature.headline}
        </h3>
        {(profile || mix) && (
          <div style={{ marginTop: space[1] }}>
            {profile && (
              <Link
                to={`/u/${profile.username}`}
                style={{
                  fontSize: fontSize.sm,
                  color: colors.text.muted,
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = themeColor;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = colors.text.muted;
                }}
              >
                @{profile.username}
              </Link>
            )}
            {mix && !profile && (
              <Link
                to={`/mix/${mix.id}`}
                style={{
                  fontSize: fontSize.sm,
                  color: colors.text.muted,
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = themeColor;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = colors.text.muted;
                }}
              >
                {mix.title}
                {mix.genre && ` · ${mix.genre}`}
              </Link>
            )}
          </div>
        )}
        {feature.body_text && (
          <p
            style={{
              fontSize: fontSize.sm,
              color: colors.text.secondary,
              margin: `${space[3]}px 0 0`,
              lineHeight: 1.6,
            }}
          >
            {feature.body_text}
          </p>
        )}
        {profile && mix && (
          <Link
            to={`/mix/${mix.id}`}
            style={{
              display: 'inline-block',
              marginTop: space[4],
              fontSize: fontSize.sm,
              color: themeColor,
              textDecoration: 'none',
              fontWeight: fontWeight.semibold,
            }}
          >
            {listenLabel}
          </Link>
        )}
      </div>
    </article>
  );
}

export function HiveStoryIssue() {
  const t = useTranslations('hiveStoryIssue');
  const { slug } = useParams<{ slug: string }>();
  const [issue, setIssue] = useState<HiveStoryIssueData | null>(null);
  const [features, setFeatures] = useState<HiveStoryFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setFetchError(null);

    fetch(`/api/hive-story/${slug}`)
      .then(r => {
        if (r.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error(t('issueFetchError'));
        return r.json();
      })
      .then(d => {
        if (!cancelled && d) {
          setIssue(d.issue);
          setFeatures(d.features ?? []);
        }
      })
      .catch(e => {
        if (!cancelled && !notFound) setFetchError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, notFound, t]);

  const theme = issue?.theme_color ?? colors.accent;

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 96px' }}>
        <div
          style={{
            height: 320,
            borderRadius: radius.xl,
            background: 'rgba(246,196,0,0.04)',
            border: `1px solid ${colors.border}`,
            animation: 'pulse 1.4s ease-in-out infinite',
          }}
        />
        <div style={{ marginTop: space[8], display: 'grid', gap: space[5] }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 120,
                borderRadius: radius.lg,
                background: 'rgba(246,196,0,0.04)',
                border: `1px solid ${colors.border}`,
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div
        style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 96px', textAlign: 'center' }}
      >
        <div
          style={{
            background: colors.dangerBg,
            color: colors.danger,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            display: 'inline-block',
            marginBottom: 16,
          }}
        >
          {fetchError}
        </div>
        <br />
        <Link
          to="/hive-story"
          style={{ color: colors.accent, textDecoration: 'none', fontSize: fontSize.sm }}
        >
          {t('backToHiveStory')}
        </Link>
      </div>
    );
  }

  if (notFound || !issue) {
    return (
      <div
        style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 96px', textAlign: 'center' }}
      >
        <div
          style={{
            marginBottom: space[4],
            opacity: 0.4,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <BeeMark size={46} color="rgba(246,196,0,0.6)" />
        </div>
        <p style={{ color: colors.text.muted }}>{t('thisIssueCouldnT')}</p>
        <Link
          to="/hive-story"
          style={{ color: colors.accent, textDecoration: 'none', fontSize: fontSize.sm }}
        >
          {t('backToHiveStory')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 96px' }}>
      {/* Back link */}
      <Link
        to="/hive-story"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: space[2],
          fontSize: fontSize.sm,
          color: colors.text.muted,
          textDecoration: 'none',
          marginBottom: space[8],
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = theme;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = colors.text.muted;
        }}
      >
        <span aria-hidden="true">←</span> {t('hiveStory')}
      </Link>

      {/* Hero */}
      <header
        style={{
          borderRadius: radius.xl,
          border: `1px solid ${theme}33`,
          background: `linear-gradient(135deg, rgba(8,8,6,0.95) 0%, ${theme}14 100%)`,
          overflow: 'hidden',
          marginBottom: space[10],
        }}
      >
        {issue.hero_image_url && (
          <div
            style={{
              height: 280,
              background: `url(${issue.hero_image_url}) center/cover no-repeat`,
            }}
            aria-hidden="true"
          />
        )}
        {!issue.hero_image_url && (
          <div
            style={{
              height: 200,
              background: `linear-gradient(135deg, ${theme}18, ${theme}06)`,
              display: 'grid',
              placeItems: 'center',
            }}
            aria-hidden="true"
          >
            <BeeMark size={68} color="rgba(246,196,0,0.5)" />
          </div>
        )}
        <div style={{ padding: `${space[9]}px ${space[10]}px` }}>
          <div
            style={{
              fontSize: fontSize.xs,
              color: theme,
              fontWeight: fontWeight.semibold,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: space[2],
            }}
          >
            {t('hiveStory')} · {formatMonth(issue.published_at)}
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: colors.text.primary,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {issue.title}
          </h1>
          {issue.subtitle && (
            <p
              style={{
                fontSize: fontSize.md,
                color: colors.text.secondary,
                margin: `${space[3]}px 0 0`,
                lineHeight: 1.6,
              }}
            >
              {issue.subtitle}
            </p>
          )}
        </div>
      </header>

      {/* Features */}
      {features.length === 0 ? (
        <p style={{ color: colors.text.dim, textAlign: 'center' }}>{t('noFeaturesInThis')}</p>
      ) : (
        <section>
          <h2
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              marginBottom: space[6],
            }}
          >
            {t('inThisIssue')}
          </h2>
          <div style={{ display: 'grid', gap: space[5] }}>
            {features.map(f => (
              <FeatureCard
                key={f.id}
                feature={f}
                themeColor={theme}
                listenLabel={t('listenMix', { title: f.mix?.title ?? '' })}
                typeLabel={
                  f.feature_type === 'artist'
                    ? t('featuredArtist')
                    : f.feature_type === 'mix'
                      ? t('featuredMix')
                      : f.feature_type === 'collab'
                        ? t('collabSpotlight')
                        : f.feature_type === 'scene'
                          ? t('sceneSpotlight')
                          : f.feature_type
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
