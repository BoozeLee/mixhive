import type { CSSProperties } from 'react';
import { colors, withAlpha } from '../../styles/tokens';

interface Props {
  /** Width of the bright core, as CSS length. */
  width?: number | string;
  style?: CSSProperties;
}

/**
 * A thin animated honey-line divider with a soft gold bloom — used between
 * sections for a premium, kinetic rhythm. Pure CSS, no JS, reduced-motion safe
 * (the gradient is static; only a faint shimmer animates, capped by the global
 * reduced-motion rules in mixhive.css).
 */
export function NeonDivider({ width = 220, style }: Props) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height: 2,
        margin: '0 auto',
        borderRadius: 4,
        background: `linear-gradient(90deg, transparent, ${withAlpha(colors.accent, 0.15)} 20%, ${colors.accentBright} 50%, ${withAlpha(colors.accent, 0.15)} 80%, transparent)`,
        boxShadow: `0 0 14px ${withAlpha(colors.accent, 0.45)}`,
        ...style,
      }}
    />
  );
}
