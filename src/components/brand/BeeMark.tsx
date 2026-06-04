import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  color?: string;
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * BeeMark — compact inline-SVG hive/bee glyph for icon slots, favicons,
 * loading states, and anywhere the detailed raster mascot is overkill.
 * A hexagon cell with a stylised bee body + wings, all in currentColor.
 */
export function BeeMark({
  size = 32,
  color,
  glow = false,
  className,
  style,
  title = 'MixHive',
}: Props) {
  const fill = color ?? 'currentColor';
  return (
    <svg
      role="img"
      aria-label={title}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        ...(glow ? { filter: 'drop-shadow(0 0 8px rgba(246,196,0,0.55))' } : {}),
        ...style,
      }}
    >
      <title>{title}</title>
      {/* Hex cell frame */}
      <path
        d="M32 3 58 18v28L32 61 6 46V18L32 3z"
        stroke={fill}
        strokeWidth="2.5"
        fill="none"
        opacity="0.9"
      />
      {/* Bee body — three stripes */}
      <g fill={fill}>
        <ellipse cx="32" cy="34" rx="9" ry="13" opacity="0.18" />
        <rect x="23" y="24" width="18" height="4" rx="2" />
        <rect x="23" y="32" width="18" height="4" rx="2" />
        <rect x="25" y="40" width="14" height="4" rx="2" />
        {/* Head */}
        <circle cx="32" cy="19" r="4" />
        {/* Wings */}
        <path d="M22 26c-7-4-13-2-13 3 0 4 5 6 13 3v-6z" opacity="0.55" />
        <path d="M42 26c7-4 13-2 13 3 0 4-5 6-13 3v-6z" opacity="0.55" />
      </g>
    </svg>
  );
}
