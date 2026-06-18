import { colors, gradient, shadow } from '../styles/tokens';

interface LevelBadgeProps {
  level: number;
  /** Outer pixel size of the hexagon. Default 48. */
  size?: number;
  title?: string;
}

// Hexagonal honey badge showing a level number. Reusable on profiles, the
// leaderboard, and (later) author chips. Dark numerals on a gold honey fill
// keep high contrast against the brand background.
export function LevelBadge({ level, size = 48, title }: LevelBadgeProps) {
  const safeLevel = Math.max(1, Math.floor(level || 1));
  const fontSize = Math.round(size * 0.38);
  return (
    <div
      role="img"
      aria-label={title ?? `Level ${safeLevel}`}
      title={title ?? `Level ${safeLevel}`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: gradient.honey,
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        boxShadow: shadow.honey,
        color: colors.black,
        fontWeight: 900,
        fontSize,
        lineHeight: 1,
        letterSpacing: -0.5,
      }}
    >
      {safeLevel}
    </div>
  );
}
