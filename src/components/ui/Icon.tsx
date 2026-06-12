import type { CSSProperties } from 'react';
import { ICONS, type IconKey } from '../../lib/icons';

interface IconProps {
  name: IconKey;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; omit for purely decorative icons (aria-hidden). */
  label?: string;
}

/**
 * Functional icon. Renders a single lucide icon from the registry at a
 * consistent size/stroke, inheriting color via currentColor by default.
 * This is the only way functional icons should enter the UI.
 */
export function Icon({
  name,
  size = 18,
  strokeWidth = 2,
  color,
  className,
  style,
  label,
}: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={className}
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}

interface HexIconProps extends IconProps {
  /** Outer hex cell size in px. */
  cell?: number;
  active?: boolean;
}

const HEX_CLIP = 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)';

/**
 * Brand-framed icon — a lucide glyph centered inside the gold hive hexagon.
 * Used in navigation and the Hub where the hex cell is part of the brand
 * language. Pairs the professional icon set with the hive identity.
 */
export function HexIcon({
  name,
  cell = 40,
  active = false,
  size,
  color,
  label,
  style,
}: HexIconProps) {
  const accent = active ? 'var(--hive-gold-hot, #ffd84a)' : 'var(--hive-gold, #f6c400)';
  return (
    <span
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      style={{
        width: cell,
        height: cell,
        display: 'grid',
        placeItems: 'center',
        clipPath: HEX_CLIP,
        background: active
          ? 'linear-gradient(135deg, rgba(246,196,0,0.28), rgba(246,196,0,0.08))'
          : 'linear-gradient(135deg, rgba(246,196,0,0.14), rgba(246,196,0,0.04))',
        border: `1px solid ${active ? accent : 'rgba(246,196,0,0.3)'}`,
        color: color ?? accent,
        flexShrink: 0,
        transition: 'background 0.18s, border-color 0.18s, color 0.18s',
        ...style,
      }}
    >
      <Icon name={name} size={size ?? Math.round(cell * 0.5)} color="currentColor" />
    </span>
  );
}
