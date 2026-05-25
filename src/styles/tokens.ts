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

  // Text scale
  text: {
    primary: '#eee',
    secondary: '#ccc',
    muted: '#888',
    dim: '#666',
    faint: '#444',
  },

  // Semantic
  danger: '#f55',
  dangerBg: '#2a1010',
  success: '#6c6',
  warning: '#fbca04',
  info: '#3b82f6',
} as const

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
} as const

export const radius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  pill: 999,
} as const

export const fontSize = {
  xs: 10,
  sm: 11,
  base: 13,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
} as const

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.4)',
  md: '0 4px 12px rgba(0,0,0,0.5)',
  lg: '0 8px 24px rgba(0,0,0,0.6)',
  accent: '0 4px 16px rgba(240,192,64,0.18)',
} as const

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
} as const

export const bp = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

// Convenience media-query strings for inline-style consumers that need
// to read window.matchMedia.
export const mq = {
  mobileOnly: `(max-width: ${bp.md - 1}px)`,
  tabletUp: `(min-width: ${bp.md}px)`,
  desktopUp: `(min-width: ${bp.lg}px)`,
} as const

export const transition = {
  fast: '120ms ease',
  base: '180ms ease',
  slow: '280ms ease',
} as const

export type Tokens = {
  colors: typeof colors
  space: typeof space
  radius: typeof radius
  fontSize: typeof fontSize
  fontWeight: typeof fontWeight
  shadow: typeof shadow
  z: typeof z
  bp: typeof bp
  mq: typeof mq
  transition: typeof transition
}

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
}
