// MIXHIVE brand-aware primitive layer.
// Wrap and ship — consume tokens from src/app/mixhive.css, fonts from
// src/app/layout.tsx, and brand assets from /art/* (with fallbacks).

export { HiveLogo } from './HiveLogo'
export { HiveButton } from './HiveButton'
export { HiveCard } from './HiveCard'
export { HoneycombGrid } from './HoneycombGrid'
export { HoneyDripDivider } from './HoneyDripDivider'
export { HexIcon } from './HexIcon'
export { WaveBar } from './WaveBar'
export { HiveStat } from './HiveStat'
export { HiveBadge } from './HiveBadge'
export type { HiveTier } from './HiveBadge'
export { BuzzToast } from './BuzzToast'

// Re-export the icon-name union so consumers (Landing, Navbar, MobileNav)
// don't need to import from `../../lib/assetUrl` directly.
export type { IconName } from '../../lib/assetUrl'
