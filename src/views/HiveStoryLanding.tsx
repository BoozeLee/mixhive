import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';
import { BeeMark } from '../components/brand/BeeMark';

interface HiveStoryIssue {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  theme_color: string;
  hero_image_url?: string;
  published_at: string;
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function IssueCard({ issue, hero }: { issue: HiveStoryIssue; hero?: boolean }) {
  const t = useTranslations('hiveStoryLanding');
  return (
    <Link to={`/hive-story/${issue.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article
        style={{
          borderRadius: hero ? radius.xl : radius.lg,
          border: `1px solid ${issue.theme_color}44`,
          background: hero
            ? `linear-gradient(135deg, rgba(8,8,6,0.92) 0%, ${issue.theme_color}18 100%)`
            : 'rgba(14,14,10,0.7)',
          overflow: 'hidden',
          transition: 'border-color 0.18s, box-shadow 0.18s',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${issue.theme_color}99`;
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 28px ${issue.theme_color}22`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = `${issue.theme_color}44`;
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      >
        {issue.hero_image_url && (
          <div
            style={{
              height: hero ? 240 : 120,
              background: `url(${issue.hero_image_url}) center/cover no-repeat`,
            }}
            aria-hidden="true"
          />
        )}
        {!issue.hero_image_url && (
          <div
            style={{
              height: hero ? 200 : 100,
              background: `linear-gradient(135deg, ${issue.theme_color}22, ${issue.theme_color}08)`,
              display: 'grid',
              placeItems: 'center',
            }}
            aria-hidden="true"
          >
            <BeeMark size={hero ? 52 : 34} color="rgba(246,196,0,0.6)" />
          </div>
        )}
        <div
          style={{ padding: hero ? `${space[8]}px ${space[9]}px` : `${space[5]}px ${space[6]}px` }}
        >
          <div
            style={{
              fontSize: fontSize.xs,
              color: issue.theme_color,
              fontWeight: fontWeight.semibold,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: space[2],
            }}
          >
            {formatMonth(issue.published_at)}
          </div>
          <h2
            style={{
              fontSize: hero ? 26 : fontSize.lg,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            {issue.title}
          </h2>
          {issue.subtitle && (
            <p
              style={{
                fontSize: hero ? fontSize.md : fontSize.sm,
                color: colors.text.muted,
                margin: `${space[2]}px 0 0`,
                lineHeight: 1.5,
              }}
            >
              {issue.subtitle}
            </p>
          )}
          <div
            style={{
              marginTop: space[5],
              fontSize: fontSize.sm,
              color: issue.theme_color,
              fontWeight: fontWeight.semibold,
              display: 'flex',
              alignItems: 'center',
              gap: space[2],
            }}
          >
            {t('readIssue')}<span aria-hidden="true">→</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function HiveStoryLanding() {
  const t = useTranslations('hiveStoryLanding');
  const [issues, setIssues] = useState<HiveStoryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/hive-story')
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          if (d.error) setError(d.error);
          else setIssues(d.issues ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load Hive Story issues.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [latest, ...archive] = issues;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px 96px' }}>
      <header style={{ marginBottom: space[10] }}>
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.accent,
            fontWeight: fontWeight.semibold,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: space[2],
          }}
        >
          {t('editorial')}
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: colors.text.primary, margin: 0 }}>
          {t('hiveStory')}
        </h1>
        <p style={{ color: colors.text.muted, fontSize: fontSize.md, margin: '8px 0 0' }}>
          Monthly spotlight on the artists, mixes, and collabs shaping the underground.
        </p>
      </header>

      {loading && (
        <div style={{ display: 'grid', gap: space[6] }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: i === 1 ? 340 : 160,
                borderRadius: radius.lg,
                background: 'rgba(240,192,64,0.04)',
                border: `1px solid ${colors.border}`,
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: `${space[8]}px`,
            borderRadius: radius.lg,
            border: `1px solid rgba(255,80,80,0.2)`,
            color: colors.text.muted,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div
          style={{
            padding: `${space[14]}px ${space[8]}px`,
            textAlign: 'center',
            color: colors.text.dim,
            border: `1px dashed ${colors.border}`,
            borderRadius: radius.xl,
          }}
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
          <p style={{ margin: 0 }}>{t('theFirstHiveStory')}</p>
        </div>
      )}

      {!loading && latest && (
        <section style={{ marginBottom: space[12] }}>
          <div
            style={{
              fontSize: fontSize.xs,
              color: colors.accent,
              fontWeight: fontWeight.semibold,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: space[4],
            }}
          >
            {t('latestIssue')}
          </div>
          <IssueCard issue={latest} hero />
        </section>
      )}

      {!loading && archive.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              marginBottom: space[6],
            }}
          >
            {t('archive')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: space[5],
            }}
          >
            {archive.map(issue => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
