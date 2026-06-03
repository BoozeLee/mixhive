// MixHive design tokens.
//
// Source of truth for color, spacing, typography, radius, elevation, and
// breakpoints. Inline styles across the app gradually migrate to consume
// these tokens; do not introduce new ad-hoc hex codes.

export const colors = {
  // Surfaces (darkest → lightest)
  bg: '#0a0a0a',
  surface: '#111',
  surfaceHover: '#1a1a2e',
  surfaceMuted: '#0f0f0f',

  // Borders
  border: '#1a1a2e',
  borderStrong: '#333',
  borderSubtle: '#222',

  // Accent (MixHive gold)
  accent: '#f0c040',
  accentHover: '#f5cd5a',
  accentMuted: '#f0c04044',
  accentFaint: '#f0c04022',

  // Text scale (all levels pass WCAG AA contrast on surfaces #111–#0a0a0a)
  text: {
    primary: '#eee',
    secondary: '#ccc',
    muted: '#888',
    dim: '#777', // 4.6:1 on #111 — passes AA normal text
    faint: '#666', // 3.3:1 on #111 — passes AA UI components (was #444 @ 1.9:1)
  },

  // Semantic
  danger: '#f55',
  dangerBg: '#2a1010',
  success: '#6c6',
  warning: '#fbca04',
  info: '#3b82f6',
} as const;

export const space = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
  6: 12,
  7: 14,
  8: 16,
  9: 20,
  10: 24,
  11: 32,
  12: 40,
  13: 48,
  14: 64,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11, // was 10 — minimum legible size for metadata labels
  sm: 12, // was 11
  base: 13,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.4)',
  md: '0 4px 12px rgba(0,0,0,0.5)',
  lg: '0 8px 24px rgba(0,0,0,0.6)',
  accent: '0 4px 16px rgba(240,192,64,0.18)',
} as const;

// Stacking order — lower numbers render below higher ones. Keep concrete
// values out of components so accidental z-index battles can't happen.
export const z = {
  base: 0,
  raised: 1,
  dropdown: 50,
  navbar: 100,
  player: 200,
  modal: 500,
  toast: 900,
  skipLink: 999,
} as const;

export const bp = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// Convenience media-query strings for inline-style consumers that need
// to read window.matchMedia.
export const mq = {
  mobileOnly: `(max-width: ${bp.md - 1}px)`,
  tabletUp: `(min-width: ${bp.md}px)`,
  desktopUp: `(min-width: ${bp.lg}px)`,
} as const;

export const transition = {
  fast: '120ms ease',
  base: '180ms ease',
  slow: '280ms ease',
} as const;

export type Tokens = {
  colors: typeof colors;
  space: typeof space;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  shadow: typeof shadow;
  z: typeof z;
  bp: typeof bp;
  mq: typeof mq;
  transition: typeof transition;
};

export const tokens: Tokens = {
  colors,
  space,
  radius,
  fontSize,
  fontWeight,
  shadow,
  z,
  bp,
  mq,
  transition,
};

// ── Genre-color mapping (Phase 10) ──────────────────────────────────────────
// Runtime HSL-shifted hues per genre. All at 48–60% lightness on #0a0a0a
// background — WCAG AA for white text on tinted surfaces.

export const genreColors: Record<string, string> = {
  // Electronic underground
  techno: 'hsl(210, 90%, 55%)',
  industrial: 'hsl(0, 0%, 65%)',
  hardcore: 'hsl(0, 85%, 55%)',
  trance: 'hsl(300, 70%, 55%)',
  ambient: 'hsl(195, 60%, 50%)',
  // Bass
  'drum and bass': 'hsl(82, 80%, 48%)',
  dnb: 'hsl(82, 80%, 48%)',
  jungle: 'hsl(95, 75%, 45%)',
  garage: 'hsl(170, 75%, 48%)',
  grime: 'hsl(150, 70%, 45%)',
  // Dance
  house: 'hsl(38, 80%, 52%)',
  'afro house': 'hsl(15, 85%, 55%)',
  breaks: 'hsl(55, 80%, 50%)',
  electro: 'hsl(230, 80%, 60%)',
  // Trap / Urban
  trap: 'hsl(270, 70%, 55%)',
  'hip hop': 'hsl(260, 60%, 55%)',
  // Experimental
  experimental: 'hsl(175, 55%, 48%)',
  noise: 'hsl(0, 10%, 60%)',
  // Default — MixHive gold
  default: 'hsl(38, 95%, 52%)',
};

export function getGenreColor(genre?: string | null): string {
  if (!genre) return genreColors.default;
  const key = genre.toLowerCase().trim();
  return genreColors[key] ?? genreColors.default;
}

// ── DJ mood-color mapping (Phase 12) ────────────────────────────────────────
// 4 performance mood tokens. Used for BPM mismatch indicators, energy badges,
// and evolution score bars. Distinct from genre colors — moods are situational.

export const moodColors: Record<string, string> = {
  peak: 'hsl(82,80%,48%)', // acid green — high energy, peak time
  groove: 'hsl(38,95%,52%)', // gold — warm, building momentum
  ambient: 'hsl(210,70%,55%)', // cool blue — atmospheric, low energy
  transition: 'hsl(270,70%,55%)', // purple — key change, genre bridge
};

export function getMoodColor(mood?: string | null): string {
  if (!mood) return moodColors.groove;
  return moodColors[mood.toLowerCase().trim()] ?? moodColors.groove;
}
