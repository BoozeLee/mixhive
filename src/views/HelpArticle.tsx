import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { getArticle } from '../content/help';
import { NotFoundState } from '../components/EmptyState';
import { GlowText } from '../components/ui/GlowText';
import { Icon } from '../components/ui/Icon';
import { colors, space, radius, fontSize, fontWeight } from '../styles/tokens';

// Hive-themed renderers for markdown elements.
const md: Components = {
  h1: ({ children }) => (
    <GlowText
      as="h1"
      variant="gradient"
      style={{
        display: 'block',
        fontFamily: 'var(--font-display, system-ui)',
        fontSize: 'clamp(24px,4vw,34px)',
        fontWeight: 800,
        lineHeight: 1.15,
        margin: '28px 0 12px',
      }}
    >
      {children}
    </GlowText>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        fontFamily: 'var(--font-display, system-ui)',
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.accent,
        margin: '28px 0 10px',
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text.primary,
        margin: '20px 0 8px',
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      style={{
        fontSize: fontSize.md,
        lineHeight: 1.7,
        color: colors.text.secondary,
        margin: '0 0 14px',
      }}
    >
      {children}
    </p>
  ),
  a: ({ href, children }) => {
    const internal = href?.startsWith('/');
    const style = { color: colors.accent, textDecoration: 'none', fontWeight: fontWeight.semibold };
    return internal ? (
      <Link to={href!} style={style}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noreferrer" style={style}>
        {children}
      </a>
    );
  },
  ul: ({ children }) => (
    <ul
      style={{ margin: '0 0 16px', paddingLeft: 22, color: colors.text.secondary, lineHeight: 1.7 }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      style={{ margin: '0 0 16px', paddingLeft: 22, color: colors.text.secondary, lineHeight: 1.7 }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ marginBottom: 6, fontSize: fontSize.md }}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: '0 0 16px',
        padding: `${space[4]}px ${space[6]}px`,
        borderLeft: `3px solid ${colors.accent}`,
        background: 'rgba(246,196,0,0.06)',
        borderRadius: radius.sm,
        color: colors.text.secondary,
        fontStyle: 'italic',
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const block = (className ?? '').includes('language-');
    if (block) {
      return (
        <pre
          style={{
            margin: '0 0 16px',
            padding: space[6],
            borderRadius: radius.md,
            background: '#0b0b08',
            border: `1px solid ${colors.border}`,
            overflowX: 'auto',
          }}
        >
          <code
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: fontSize.sm,
              color: '#e8dcae',
              lineHeight: 1.6,
            }}
          >
            {children}
          </code>
        </pre>
      );
    }
    return (
      <code
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.9em',
          background: 'rgba(246,196,0,0.1)',
          color: colors.accentHover,
          padding: '1px 6px',
          borderRadius: 4,
        }}
      >
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: fontSize.sm }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 12px',
        borderBottom: `1px solid ${colors.accentMuted}`,
        color: colors.accent,
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${colors.border}`,
        color: colors.text.secondary,
      }}
    >
      {children}
    </td>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '24px 0' }} />
  ),
};

export function HelpArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getArticle(slug) : undefined;

  if (!article) {
    return (
      <div id="main-content" style={{ maxWidth: 760, margin: '0 auto', padding: '40px 16px' }}>
        <NotFoundState what="help article" backTo="/help" backLabel="Back to Help Center" />
      </div>
    );
  }

  return (
    <div id="main-content" style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 96px' }}>
      <Link
        to="/help"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: space[2],
          color: colors.text.muted,
          textDecoration: 'none',
          fontSize: fontSize.sm,
          marginBottom: space[8],
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = colors.accent;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = colors.text.muted;
        }}
      >
        <Icon name="help" size={15} color="currentColor" /> Help Center
      </Link>

      <header style={{ marginBottom: space[8] }}>
        <h1
          style={{
            fontFamily: 'var(--font-display, system-ui)',
            fontSize: 'clamp(28px,5vw,40px)',
            fontWeight: 800,
            color: colors.text.primary,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {article.title}
        </h1>
        <p
          style={{
            fontSize: fontSize.lg,
            color: colors.text.muted,
            margin: '12px 0 0',
            lineHeight: 1.5,
          }}
        >
          {article.summary}
        </p>
      </header>

      <article>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
          {article.body}
        </ReactMarkdown>
      </article>
    </div>
  );
}
