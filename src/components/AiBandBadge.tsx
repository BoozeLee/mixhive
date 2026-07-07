import { colors, radius } from '../styles/tokens';

interface AiBandBadgeProps {
  size?: 'sm' | 'md';
}

// Gold "AI Band" pill — marks a track that has AI-agent co-producer credits.
export function AiBandBadge({ size = 'sm' }: AiBandBadgeProps) {
  const sm = size === 'sm';
  return (
    <span
      title="Co-produced with AI agents"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: sm ? 10 : 12,
        fontWeight: 800,
        letterSpacing: 0.3,
        padding: sm ? '2px 7px' : '3px 10px',
        borderRadius: radius.pill,
        background: colors.accentFaint,
        border: `1px solid ${colors.accentMuted}`,
        color: colors.accent,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">✦</span> AI Band
    </span>
  );
}
