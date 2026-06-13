import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HELP_CATEGORIES, HELP_ARTICLES, articlesByCategory } from '../content/help';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Reveal } from '../components/ui/Reveal';
import { Icon } from '../components/ui/Icon';
import { colors, space, radius, fontSize, fontWeight } from '../styles/tokens';

export function HelpCenter() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return HELP_ARTICLES.filter(
      a =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '32px 16px 96px' }}>
      <header style={{ marginBottom: space[10] }}>
        <SectionHeading
          eyebrow="Help Center"
          title="How can we help?"
          subtitle="Guides for getting started, uploading mixes, building AI agents, quests, the marketplace, and your account."
        />
      </header>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 520, marginBottom: space[11] }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.text.dim,
            display: 'flex',
          }}
        >
          <Icon name="search" size={17} color="currentColor" />
        </span>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search help articles…"
          aria-label="Search help articles"
          style={{
            width: '100%',
            padding: '12px 14px 12px 42px',
            borderRadius: radius.pill,
            border: `1px solid ${colors.accentMuted}`,
            background: colors.surface,
            color: colors.text.primary,
            fontSize: fontSize.md,
            outline: 'none',
          }}
        />
      </div>

      {/* Search results */}
      {results !== null ? (
        <section>
          <h2
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              marginBottom: space[6],
            }}
          >
            {results.length} result{results.length !== 1 ? 's' : ''}
          </h2>
          <div style={{ display: 'grid', gap: space[4] }}>
            {results.map((a, i) => (
              <Reveal key={a.slug} index={i}>
                <ArticleRow slug={a.slug} title={a.title} summary={a.summary} />
              </Reveal>
            ))}
            {results.length === 0 && (
              <p style={{ color: colors.text.dim }}>
                No articles match "{query}". Try a different term.
              </p>
            )}
          </div>
        </section>
      ) : (
        /* Category browse */
        <div style={{ display: 'grid', gap: space[12] }}>
          {HELP_CATEGORIES.map((cat, ci) => {
            const arts = articlesByCategory(cat.id);
            if (arts.length === 0) return null;
            return (
              <Reveal key={cat.id} index={ci}>
                <section>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: space[4],
                      marginBottom: space[6],
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 40,
                        height: 40,
                        display: 'grid',
                        placeItems: 'center',
                        clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)',
                        background: 'rgba(246,196,0,0.12)',
                        color: colors.accent,
                      }}
                    >
                      <Icon name={cat.icon} size={19} color="currentColor" />
                    </span>
                    <div>
                      <h2
                        style={{
                          fontSize: fontSize.lg,
                          fontWeight: fontWeight.bold,
                          color: colors.text.primary,
                          margin: 0,
                          fontFamily: 'var(--font-display, system-ui)',
                        }}
                      >
                        {cat.label}
                      </h2>
                      <p
                        style={{
                          fontSize: fontSize.sm,
                          color: colors.text.muted,
                          margin: '2px 0 0',
                        }}
                      >
                        {cat.blurb}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: space[4],
                    }}
                  >
                    {arts.map(a => (
                      <ArticleRow key={a.slug} slug={a.slug} title={a.title} summary={a.summary} />
                    ))}
                  </div>
                </section>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArticleRow({ slug, title, summary }: { slug: string; title: string; summary: string }) {
  return (
    <Link to={`/help/${slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        style={{
          height: '100%',
          padding: `${space[5]}px ${space[6]}px`,
          borderRadius: radius.lg,
          border: `1px solid ${colors.accentMuted}`,
          background: 'rgba(16,14,10,0.6)',
          transition: 'border-color 0.15s',
          display: 'flex',
          flexDirection: 'column',
          gap: space[2],
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = colors.accent;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = colors.accentMuted;
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space[3],
          }}
        >
          <span
            style={{
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
            }}
          >
            {title}
          </span>
          <Icon name="external" size={14} color={colors.text.dim} />
        </div>
        <span style={{ fontSize: fontSize.sm, color: colors.text.muted, lineHeight: 1.5 }}>
          {summary}
        </span>
      </div>
    </Link>
  );
}
