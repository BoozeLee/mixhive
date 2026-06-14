import { ImageWithFallback, type IconName } from '../../lib/assetUrl';
import { colors } from '../../styles/tokens';

interface Props {
  name: IconName;
  size?: number;
  active?: boolean;
  label?: string;
}

// Built-in inline-SVG fallbacks — used when ComfyUI assets are not present.
// Each is a single glyph drawn inside a centered hexagon. Brand-aware via
// currentColor; the HexIcon wrapper sets color = var(--hive-gold).
const FALLBACK_GLYPHS: Record<IconName, JSX.Element> = {
  'hive-feed': (
    <g>
      <circle cx="32" cy="32" r="8" />
      <circle cx="32" cy="14" r="4" />
      <circle cx="32" cy="50" r="4" />
      <circle cx="16" cy="23" r="4" />
      <circle cx="48" cy="23" r="4" />
      <circle cx="16" cy="41" r="4" />
      <circle cx="48" cy="41" r="4" />
    </g>
  ),
  'swarm-chat': (
    <g>
      <path d="M22 26 a6 6 0 1 1 0 12 a6 6 0 1 1 0-12 z" />
      <path d="M42 26 a6 6 0 1 1 0 12 a6 6 0 1 1 0-12 z" />
      <path d="M28 34 q4 4 8 0" stroke="currentColor" strokeWidth="2" fill="none" />
    </g>
  ),
  'nectar-upload': (
    <g>
      <path d="M32 14 l-10 14 h6 v18 h8 V28 h6 z" />
    </g>
  ),
  'queen-mode': (
    <g>
      <path d="M18 38 l4 -14 l5 8 l5 -12 l5 12 l5 -8 l4 14 z" />
      <rect x="20" y="40" width="24" height="6" rx="1" />
    </g>
  ),
  'mix-vault': (
    <g>
      <circle cx="32" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="32" r="3" />
      <line x1="32" y1="18" x2="32" y2="14" stroke="currentColor" strokeWidth="2" />
      <line x1="32" y1="50" x2="32" y2="46" stroke="currentColor" strokeWidth="2" />
    </g>
  ),
  'vinyl-marketplace': (
    <g>
      <circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="32" r="9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="2.5" />
    </g>
  ),
  'buzz-alerts': (
    <g>
      <path d="M32 14 c-6 0 -10 4 -10 10 v8 l-3 6 h26 l-3 -6 v-8 c0 -6 -4 -10 -10 -10 z" />
      <path d="M28 42 q4 4 8 0" stroke="currentColor" strokeWidth="2" fill="none" />
    </g>
  ),
  'hive-radar': (
    <g>
      <circle cx="32" cy="32" r="3" />
      <path d="M32 32 L48 22 A18 18 0 0 0 32 14 z" fill="currentColor" opacity="0.4" />
      <circle
        cx="32"
        cy="32"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.6"
      />
      <circle
        cx="32"
        cy="32"
        r="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.35"
      />
    </g>
  ),
  'beecast-live': (
    <g>
      <rect x="26" y="14" width="12" height="22" rx="6" />
      <path d="M22 30 a10 10 0 0 0 20 0" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="32" y1="40" x2="32" y2="48" stroke="currentColor" strokeWidth="2" />
      <circle cx="42" cy="18" r="2.5" fill={colors.danger} />
    </g>
  ),
  'honeydrop-nft': (
    <g>
      <path d="M32 12 l14 18 a14 14 0 1 1 -28 0 z" />
      <circle cx="32" cy="30" r="3" fill={`var(--hive-black, ${colors.black})`} />
    </g>
  ),
};

/**
 * Hex-framed icon. Renders the ComfyUI-traced SVG from /art/icons/<name>.svg
 * when present; falls back to a built-in inline SVG glyph so the UI is
 * complete even before any asset generation has happened.
 */
export function HexIcon({ name, size = 48, active = false, label }: Props) {
  const colour = active
    ? `var(--hive-gold-hot, ${colors.accentBrightest})`
    : `var(--hive-gold, ${colors.accentBright})`;

  return (
    <span
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        color: colour,
        transition: 'filter 200ms ease, color 200ms ease',
        filter: active
          ? 'drop-shadow(0 0 12px var(--hive-glow, rgba(246,196,0,0.55)))'
          : 'drop-shadow(0 0 6px rgba(246,196,0,0.25))',
      }}
    >
      {/* Hex frame — always rendered, makes the icon size predictable */}
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0 }}
      >
        <polygon
          points="32,2 60,18 60,46 32,62 4,46 4,18"
          fill={`var(--hive-ink, ${colors.bg})`}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>

      {/* Try ComfyUI SVG asset; if it loads, it covers the inline fallback */}
      <ImageWithFallback
        asset={`icon-${name}`}
        alt=""
        width={Math.round(size * 0.65)}
        height={Math.round(size * 0.65)}
        style={{
          position: 'relative',
          zIndex: 1,
          width: Math.round(size * 0.65),
          height: Math.round(size * 0.65),
          objectFit: 'contain',
        }}
      />

      {/* Inline-SVG fallback — visible if the <img> above never loads */}
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        width={Math.round(size * 0.65)}
        height={Math.round(size * 0.65)}
        style={{ position: 'absolute', zIndex: 0, fill: 'currentColor' }}
      >
        {FALLBACK_GLYPHS[name]}
      </svg>
    </span>
  );
}
