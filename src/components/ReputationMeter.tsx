import { colors, space } from '../styles/tokens';

interface ReputationMeterProps {
  score: number;
  /**
   * Whether this profile actually has reviews. The DB seeds `reputation_score`
   * to 5.0 by default, so without this gate a brand-new, unreviewed profile
   * would misleadingly show a perfect score. Callers pass `xp > 0` as the
   * "has activity" proxy.
   */
  hasReviews: boolean;
}

// 0–5 reputation read-out. Shows five star glyphs filled to the rounded score
// plus the numeric value; renders "Not yet rated" when there are no reviews.
export function ReputationMeter({ score, hasReviews }: ReputationMeterProps) {
  if (!hasReviews) {
    return (
      <div>
        <div style={{ color: colors.text.secondary, fontSize: 12, fontWeight: 700 }}>
          Reputation
        </div>
        <div style={{ color: colors.text.faint, fontSize: 13, marginTop: space[2] }}>
          Not yet rated
        </div>
      </div>
    );
  }

  const clamped = Math.min(5, Math.max(0, score || 0));
  const filled = Math.round(clamped);
  return (
    <div>
      <div style={{ color: colors.text.secondary, fontSize: 12, fontWeight: 700 }}>Reputation</div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: space[3], marginTop: space[2] }}
        role="img"
        aria-label={`Reputation ${clamped.toFixed(1)} out of 5`}
      >
        <span aria-hidden="true" style={{ letterSpacing: 2, fontSize: 14 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} style={{ color: i < filled ? colors.accent : colors.text.faintest }}>
              ★
            </span>
          ))}
        </span>
        <span style={{ color: colors.text.primary, fontSize: 13, fontWeight: 800 }}>
          {clamped.toFixed(1)}
        </span>
        <span style={{ color: colors.text.faint, fontSize: 11 }}>/ 5</span>
      </div>
    </div>
  );
}
