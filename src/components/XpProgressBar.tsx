import { colors, gradient, radius, space } from '../styles/tokens';
import { levelProgress } from '../lib/xp';

interface XpProgressBarProps {
  xp: number;
}

// Gold fill bar showing progress through the current level, with a label of
// XP earned toward the next level. Respects prefers-reduced-motion via CSS
// (transition is purely cosmetic and the bar renders correctly without it).
export function XpProgressBar({ xp }: XpProgressBarProps) {
  const { level, xpIntoLevel, xpForThisLevel, pct } = levelProgress(xp);
  const totalXp = Math.max(0, Math.floor(xp || 0));
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: space[4],
          marginBottom: space[3],
        }}
      >
        <span style={{ color: colors.text.primary, fontWeight: 800, fontSize: 14 }}>
          Level {level}
        </span>
        <span style={{ color: colors.text.dim, fontSize: 12 }}>
          {xpIntoLevel} / {xpForThisLevel} XP
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={xpForThisLevel}
        aria-valuenow={xpIntoLevel}
        aria-label={`Level ${level} progress`}
        style={{
          width: '100%',
          height: 10,
          background: colors.surfaceMuted,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.pill,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(pct * 100)}%`,
            height: '100%',
            background: gradient.honey,
            borderRadius: radius.pill,
            transition: 'width 450ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      <div style={{ color: colors.text.faint, fontSize: 11, marginTop: space[3] }}>
        {totalXp.toLocaleString()} total XP
      </div>
    </div>
  );
}
