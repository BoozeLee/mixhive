import type { CSSProperties } from 'react';

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
        borderRadius: 2,
        background:
          'linear-gradient(90deg, transparent, rgba(246,196,0,0.15) 20%, #f6c400 50%, rgba(246,196,0,0.15) 80%, transparent)',
        boxShadow: '0 0 14px rgba(246,196,0,0.45)',
        ...style,
      }}
    />
  );
}
