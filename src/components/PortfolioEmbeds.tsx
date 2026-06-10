'use client';

import { colors, fontSize, radius } from '../styles/tokens';
import { toEmbed } from '../lib/embedUrl';

// Renders rich provider embeds for a profile's social_links (SoundCloud, Spotify,
// YouTube, Mixcloud); everything else falls back to a styled link card. Renders
// nothing when there are no links.
export function PortfolioEmbeds({ links }: { links?: Record<string, string> | null }) {
  const entries = Object.entries(links ?? {}).filter(
    ([, url]) => typeof url === 'string' && url.trim().length > 0
  );
  if (entries.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      {entries.map(([platform, url]) => {
        const e = toEmbed(url);
        if (e.kind === 'iframe') {
          return (
            <iframe
              key={platform}
              src={e.src}
              title={`${platform} — ${e.title}`}
              loading="lazy"
              allow="encrypted-media; clipboard-write; fullscreen; picture-in-picture"
              style={{
                width: '100%',
                height: e.height,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
              }}
            />
          );
        }
        return (
          <a
            key={platform}
            href={e.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              padding: '10px 12px',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              color: colors.text.primary,
              fontSize: fontSize.sm,
              textDecoration: 'none',
            }}
          >
            <span style={{ textTransform: 'capitalize' }}>{platform}</span>{' '}
            <span style={{ color: colors.text.dim }}>· {e.label}</span>
          </a>
        );
      })}
    </div>
  );
}
