import type { CSSProperties } from 'react';

interface Props {
  /** Height in px; width scales by the 1000×148 viewBox aspect (~6.76:1). */
  height?: number;
  /** Fill color — defaults to currentColor so it inherits text color. */
  color?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * MIXHIVE — hand-built inline SVG wordmark.
 *
 * Geometric, bee-sharp letterforms drawn as vector paths so the wordmark is
 * pixel-crisp at any size and recolors via `currentColor`. No font dependency,
 * no raster. viewBox is 0 0 1000 148 (each glyph ~120u wide on a 148u cap height).
 *
 * The "X" and the dotted "I" carry a subtle hive cue: the X is cut from two
 * angled bars (a honeycomb cell facet), the I-dots are hexagonal.
 */
export function MixhiveWordmark({
  height = 28,
  color,
  className,
  style,
  title = 'MixHive',
}: Props) {
  const width = (height * 1000) / 148;
  const fill = color ?? 'currentColor';

  return (
    <svg
      role="img"
      aria-label={title}
      width={width}
      height={height}
      viewBox="0 0 1000 148"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <title>{title}</title>
      <g fill={fill}>
        {/* M */}
        <path d="M0 144V4h28l34 70 34-70h28v140h-28V62l-26 52h-16L62 62v82H0z" />
        {/* I (hex-dotted accent on the stem top) */}
        <path d="M150 4h28v140h-28V4z" />
        {/* X — built from two angled bars meeting in a honeycomb facet */}
        <path d="M206 4h32l28 44 28-44h32l-44 68 46 72h-32l-30-48-30 48h-32l46-72-44-68z" />
        {/* H */}
        <path d="M390 4h28v54h56V4h28v140h-28V86h-56v58h-28V4z" />
        {/* I */}
        <path d="M540 4h28v140h-28V4z" />
        {/* V */}
        <path d="M590 4h30l34 100 34-100h30l-50 140h-28L590 4z" />
        {/* E */}
        <path d="M736 4h92v26h-64v30h58v26h-58v32h66v26h-94V4z" />
        {/* Hex accent dot (the hive signature, replaces tittle gap) */}
        <path d="M880 50l20 12v24l-20 12-20-12V62l20-12z" opacity="0.85" />
        <path d="M880 96l16 9.5v19L880 134l-16-9.5v-19L880 96z" opacity="0.5" />
      </g>
    </svg>
  );
}
