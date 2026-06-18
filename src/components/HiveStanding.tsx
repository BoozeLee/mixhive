import { colors, radius, space } from '../styles/tokens';
import { LevelBadge } from './LevelBadge';
import { XpProgressBar } from './XpProgressBar';
import { ReputationMeter } from './ReputationMeter';
import { levelForXp } from '../lib/xp';

interface HiveStandingProps {
  xp?: number | null;
  level?: number | null;
  reputationScore?: number | null;
}

// "Hive Standing" card — composes the level badge, XP-to-next-level bar, and
// reputation meter into a single brand-consistent panel for the profile.
export function HiveStanding({ xp, level, reputationScore }: HiveStandingProps) {
  const safeXp = Math.max(0, Math.floor(xp ?? 0));
  // Prefer the stored level, but fall back to deriving it so the badge is never
  // out of sync with XP if the column lags behind.
  const safeLevel = level && level > 0 ? Math.floor(level) : levelForXp(safeXp);
  const hasReviews = safeXp > 0;

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colors.surface}, ${colors.accentFaint})`,
        border: `1px solid ${colors.accentMuted}`,
        borderRadius: radius.lg,
        padding: space[8],
        marginTop: space[5],
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: space[8],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space[6] }}>
        <LevelBadge level={safeLevel} size={56} />
        <div>
          <div style={{ color: colors.accent, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
            HIVE STANDING
          </div>
          <ReputationMeter score={reputationScore ?? 5} hasReviews={hasReviews} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <XpProgressBar xp={safeXp} />
      </div>
    </div>
  );
}
