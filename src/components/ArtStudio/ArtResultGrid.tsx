'use client';

import { colors, fontSize, radius, space } from '../../styles/tokens';

export interface ArtResult {
  url: string;
  prompt: string;
  style: string;
  saved?: boolean;
}

export function ArtResultGrid({
  results,
  onUseAsArtwork,
  onDownload,
  saving,
}: {
  results: ArtResult[];
  onUseAsArtwork: (url: string) => void;
  onDownload: (url: string) => void;
  saving: string | null;
}) {
  if (results.length === 0) return null;

  return (
    <div>
      <div
        style={{
          fontSize: fontSize.xs,
          color: colors.text.dim,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: space[4],
        }}
      >
        Generated
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: space[6],
        }}
      >
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${r.saved ? colors.accent : colors.border}`,
              borderRadius: radius.lg,
              overflow: 'hidden',
              background: colors.surface,
            }}
          >
            <img
              src={r.url}
              alt={`Generated art ${i + 1}`}
              style={{
                width: '100%',
                aspectRatio: '1/1',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div style={{ padding: space[4], display: 'flex', gap: space[3], flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onUseAsArtwork(r.url)}
                disabled={saving === r.url || !!r.saved}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: r.saved ? colors.accentFaint : colors.accentBright,
                  color: r.saved ? colors.accent : colors.black,
                  border: 'none',
                  borderRadius: radius.md,
                  fontSize: fontSize.sm,
                  fontWeight: 600,
                  cursor: r.saved ? 'default' : 'pointer',
                  opacity: saving === r.url ? 0.6 : 1,
                }}
              >
                {r.saved ? '✓ Saved' : saving === r.url ? 'Saving…' : 'Use as Artwork'}
              </button>
              <button
                type="button"
                onClick={() => onDownload(r.url)}
                style={{
                  padding: '8px 12px',
                  background: colors.surfaceHover,
                  color: colors.text.secondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  fontSize: fontSize.sm,
                  cursor: 'pointer',
                }}
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
