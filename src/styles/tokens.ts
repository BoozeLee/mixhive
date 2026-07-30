// MixHive design tokens.
//
// Source of truth for color, spacing, typography, radius, elevation, and
// breakpoints. Inline styles across the app gradually migrate to consume
// these tokens; do not introduce new ad-hoc hex codes.

export const colors = {
  // Surfaces (darkest → lightest).
  //
  // Warm near-blacks, not neutral ones. These used to disagree with the
  // --hive-* custom properties in mixhive.css (#0a0a0a here vs #030303 there),
  // so components and shell chrome rendered subtly different surfaces on the
  // same page. Both sides now carry identical values, enforced by
  // src/__tests__/palette-parity.test.ts.
  bg: '#070706',
  surface: '#0f0e0c',
  surfaceHover: '#17150f',
  surfaceMuted: '#0b0a09',

  // Borders
  // Both borders used to be cool — #1a1a2e is navy-tinted and #333 is a flat
  // neutral — which read as a blue-grey edge drawn around warm black surfaces.
  // These carry the same perceptual weight as the values they replace (1.14 and
  // 1.51 against `surface`, versus 1.13 and 1.53) so nothing gets harder to see;
  // only the hue moves, into the same warm family as the rest of the palette.
  border: '#1f1d16',
  borderStrong: '#35322a',
  borderSubtle: '#171510',

  // Accent (MixHive gold).
  //
  // Two different golds were in play — #f0c040 here, #f6c400 in mixhive.css.
  // Unified on the more saturated hive gold. 11.77:1 on `surface`.
  accent: '#f6c400',
  accentHover: '#ffd84a',
  accentMuted: '#f6c40044',
  accentFaint: '#f6c40022',

  // Text scale — warm, not neutral grey.
  //
  // The old ramp (#eee/#ccc/#888) was neutral while mixhive.css ran a warm cream
  // ramp, so body copy and shell copy visibly disagreed. Unified on warm, which
  // also suits the honey identity. Ratios measured against `surface` (#0f0e0c);
  // every level improved or held.
  text: {
    primary: '#f5f3e7', // 17.32:1 — AA text
    secondary: '#d4cdb0', // 12.09:1 — AA text
    dimmed: '#b8b09a', // 8.93:1 — AA text
    muted: '#a9a390', // 7.65:1 — AA text
    dim: '#8c8676', // 5.32:1 — AA text (was #808080 @ 4.78:1)
    faint: '#6f6a5c', // 3.58:1 — AA UI components (was #666 @ 3.3:1)
    faintest: '#57534a', // 2.52:1 — decorative/disabled only, below AA for text
  },

  // Semantic
  danger: '#ff6b5e', // 6.91:1 on surface — AA text
  dangerStrong: '#ef4444',
  dangerBg: '#2a1010',
  dangerBgDeep: '#1a0000',
  success: '#7eed8b', // 13.21:1 on surface — AA text
  successStrong: '#22c55e',
  successBg: '#1a3a1a',
  warning: '#fbca04',
  info: '#3b82f6',

  // Brighter gold (WebGL backdrop / highlight) + raised surface + pure b/w
  accentBright: '#f6c400',
  accentBrightest: '#ffde4d', // honey-gradient start
  accentDeep: '#b96a00', // honey/ember-gradient end
  accentAmber: '#ff8c1a', // honey/ember-gradient mid-amber
  accentCyan: '#25d9ff', // cool secondary accent (mesh backdrop)
  surfaceRaised: '#1e1c17',
  surfaceTint: '#2a1a2e', // purple-tinted surface (gradient pair with `border`)
  hiveText: '#f5f3e7', // brand cream text (--hive-text)
  successBright: '#7eed8b', // bright mint indicator (online/active)
  black: '#000',
  white: '#fff',
} as const;

/**
 * Opacity overlay on a token color → `rgba(...)`. Replaces ad-hoc 8-digit hex
 * alphas (e.g. `#f0c04022`) so overlays reference a base token + explicit alpha.
 * `withAlpha(colors.accent, 0.13)` === `'rgba(246, 196, 0, 0.13)'`.
 */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const f =
    h.length === 3
      ? h
          .split('')
          .map(c => c + c)
          .join('')
      : h;
  const n = parseInt(f, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Profile art-studio drawing palette — user-facing brush colors (a content
// data set, not theme tokens). Kept here so no raw hex lives in components.
export const artPalette = {
  'electric purple': '#8b2fd6',
  'acid green': '#7CFC00',
  'hot pink': '#ff3d9a',
  'cosmic blue': '#2b6bff',
  'bright orange': '#ff7a18',
  magenta: '#d6249f',
  'blacklight teal': '#1fd3c3',
} as const;

// Achievement medal-tier colors (content data for scene/leaderboard badges).
export const tierColors = {
  platinum: '#d8d8e8',
  gold: '#e8c14a',
  silver: '#b8b8c0',
  bronze: '#b07a4a',
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
  // Messages.tsx reads space[15] for its bottom gutter (pre-sweep: 96px), but
  // the scale stopped at 14 — so the padding shorthand rendered as
  // `undefinedpx` and the whole declaration was dropped by the browser.
  15: 96,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  pill: 999,
  full: 999, // alias of pill — fully rounded (avatars, chips, circular controls)
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
  accent: '0 4px 16px rgba(246,196,0,0.18)',
  // Premium layered elevations with gold bleed — for cinematic cards/panels
  elevated: '0 18px 60px rgba(0,0,0,0.5), 0 0 32px rgba(246,196,0,0.08)',
  honey: '0 0 24px rgba(246,196,0,0.35)',
  honeyStrong: '0 0 40px rgba(246,196,0,0.45), 0 0 10px rgba(246,196,0,0.6)',
} as const;

// Cinematic display type scale (clamp-based, responsive). Use for hero and
// section headlines — distinct from the UI fontSize scale above.
export const display = {
  sm: 'clamp(24px, 3vw, 32px)',
  md: 'clamp(28px, 4vw, 44px)',
  lg: 'clamp(34px, 5.5vw, 64px)',
  xl: 'clamp(40px, 8vw, 88px)',
  '2xl': 'clamp(48px, 10vw, 112px)',
} as const;

export const blur = {
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '40px',
} as const;

// Reusable gradient presets in the brand vocabulary.
export const gradient = {
  honey: 'linear-gradient(135deg, #ffde4d, #f6c400 58%, #b96a00)',
  ember: 'linear-gradient(135deg, #ffd84a, #ff8c1a 70%, #b96a00)',
  goldText: 'linear-gradient(120deg, #fff 18%, #ffd84a 55%, #f6c400 100%)',
  meshTop: 'radial-gradient(ellipse at 80% 10%, rgba(246,196,0,0.10) 0%, transparent 65%)',
  meshBottom: 'radial-gradient(ellipse at 10% 90%, rgba(37,217,255,0.06) 0%, transparent 70%)',
  scanline: 'repeating-linear-gradient(180deg, transparent 0 3px, rgba(0,0,0,0.18) 3px 4px)',
} as const;

// Motion tokens — keep durations/easing consistent with src/lib/motion.ts
export const motion = {
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
  durXs: '120ms',
  durSm: '180ms',
  durMd: '280ms',
  durLg: '450ms',
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

// Chrome dimensions shared by fixed shell elements and the content column.
// Values are the literals these call sites carried before the P1 sweep
// (1128c01) replaced them with `layout.*` references; the export itself was
// never added, which is what broke the build.
export const layout = {
  // Fallback only — `--navbar-height` in mixhive.css is authoritative and is
  // currently 64px. 73 is preserved here because that is what the fallback was
  // before the sweep; changing it would be a behaviour change, not a fix.
  navbarHeight: 73,
  sidebarWidth: 220,
  mobileNavHeight: 60,
  contentMaxWidth: 640,
} as const;

export const transition = {
  fast: '120ms ease',
  base: '180ms ease',
  slow: '280ms ease',
  // The P1 sweep (1128c01) rewrote four call sites to `transition.smooth`
  // without adding the key, so Navbar, Feed and Landing have been rendering
  // `transition: undefined` — those animations simply did not run. 250ms is
  // Navbar's exact pre-sweep value ('height 0.25s ease, …'), so restoring it
  // here fixes all four sites without editing any of them.
  smooth: '250ms ease',
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

// Genre colour-coding. These were a full-spectrum rainbow at 70–90% saturation
// — electric blue next to pure magenta next to acid green — which fought the
// black/gold brand and read as the page's most "amateur" surface after the
// display type. Retuned into a warm-anchored, muted harmony: each genre keeps
// its hue identity (techno stays cool, house stays gold) but saturation drops
// to a cohesive register and the whole set leans toward the honey accent so
// gold stays dominant. The brand-adjacent dance genres keep their richness;
// the cool/experimental ones are pulled back. Every value clears WCAG AA as
// text on the dark surface (lowest is hardcore at 6.3:1) since these render as
// coloured text and translucent fills, not just decoration.
export const genreColors: Record<string, string> = {
  // Electronic underground
  techno: 'hsl(205, 52%, 64%)',
  industrial: 'hsl(35, 10%, 64%)',
  hardcore: 'hsl(9, 66%, 63%)',
  trance: 'hsl(285, 44%, 70%)',
  ambient: 'hsl(190, 46%, 62%)',
  // Bass
  'drum and bass': 'hsl(78, 54%, 60%)',
  dnb: 'hsl(78, 54%, 60%)',
  jungle: 'hsl(108, 40%, 57%)',
  garage: 'hsl(165, 46%, 58%)',
  grime: 'hsl(150, 44%, 57%)',
  // Dance — brand-adjacent, kept warm and rich
  house: 'hsl(41, 80%, 60%)',
  'afro house': 'hsl(20, 74%, 62%)',
  breaks: 'hsl(48, 72%, 60%)',
  electro: 'hsl(224, 54%, 73%)',
  // Trap / Urban
  trap: 'hsl(268, 44%, 73%)',
  'hip hop': 'hsl(252, 40%, 70%)',
  // Experimental
  experimental: 'hsl(178, 42%, 58%)',
  noise: 'hsl(28, 7%, 62%)',
  // Default — MixHive gold
  default: 'hsl(46, 92%, 52%)',
};

export function getGenreColor(genre?: string | null): string {
  if (!genre) return genreColors.default;
  const key = genre.toLowerCase().trim();
  return genreColors[key] ?? genreColors.default;
}

// ── Agent category colors ───────────────────────────────────────────────────
// Tag chips on AgentCard. Same warm-anchored discipline as `genreColors`:
// saturation stays in the 14–78% band and lightness in 58–68%, so seven
// categories sitting side by side on one card read as a set rather than a
// rainbow. `moderation` is deliberately the quietest — a moderation tag is
// stating a fact, not asking for attention.

export const agentCategoryColors: Record<string, string> = {
  social: 'hsl(14, 62%, 65%)', // warm coral — human connection
  growth: 'hsl(96, 44%, 60%)', // green — increase
  discovery: 'hsl(196, 50%, 64%)', // teal — exploration
  moderation: 'hsl(38, 14%, 62%)', // near-neutral warm grey — restraint
  release: 'hsl(44, 78%, 58%)', // brand-adjacent gold — shipping music
  schedule: 'hsl(216, 48%, 68%)', // cool blue — time
  engagement: 'hsl(330, 46%, 68%)', // magenta — interaction
  // Default — MixHive gold, matching `genreColors.default`
  default: 'hsl(46, 92%, 52%)',
};

export function getAgentCategoryColor(category?: string | null): string {
  if (!category) return agentCategoryColors.default;
  const key = category.toLowerCase().trim();
  return agentCategoryColors[key] ?? agentCategoryColors.default;
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
