import { motion } from 'framer-motion'

export type HiveTier = 'queen' | 'worker' | 'scout' | 'drone' | 'verified'

interface Props {
  tier: HiveTier
  label?: string
  size?: 'sm' | 'md'
}

const tierConfig: Record<HiveTier, { label: string; bg: string; fg: string; glyph: string }> = {
  queen:    { label: 'QUEEN',    bg: 'linear-gradient(135deg,#ffd84a,#ff8c1a)', fg: '#030303', glyph: '♛' },
  worker:   { label: 'WORKER',   bg: 'rgba(246,196,0,0.12)',                   fg: 'var(--hive-gold, #f6c400)', glyph: '◆' },
  scout:    { label: 'SCOUT',    bg: 'rgba(37,217,255,0.12)',                  fg: 'var(--hive-blue, #25d9ff)', glyph: '◬' },
  drone:    { label: 'DRONE',    bg: 'rgba(169,163,144,0.16)',                 fg: 'var(--hive-muted, #a9a390)', glyph: '○' },
  verified: { label: 'VERIFIED', bg: 'rgba(126,237,139,0.14)',                 fg: 'var(--hive-success, #7eed8b)', glyph: '✓' },
}

/**
 * Tier pill — replaces VerificationBadgeSystem rendering with a brand-aware
 * variant. `queen` carries an 8s rotating shine overlay; others are static.
 */
export function HiveBadge({ tier, label, size = 'sm' }: Props) {
  const cfg = tierConfig[tier]
  const displayLabel = label ?? cfg.label
  const fontSize = size === 'sm' ? 10 : 12
  const padding = size === 'sm' ? '3px 8px' : '5px 12px'

  if (tier === 'queen') {
    return (
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: cfg.bg,
          color: cfg.fg,
          padding,
          borderRadius: 999,
          fontFamily: 'var(--font-ui)',
          fontWeight: 800,
          fontSize,
          letterSpacing: '0.08em',
          overflow: 'hidden',
          boxShadow: '0 0 14px rgba(246,196,0,0.45)',
        }}
      >
        <motion.span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -10,
            background:
              'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.45) 18%, transparent 36%, transparent 100%)',
            mixBlendMode: 'overlay',
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
        />
        <span aria-hidden="true" style={{ position: 'relative' }}>{cfg.glyph}</span>
        <span style={{ position: 'relative' }}>{displayLabel}</span>
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: cfg.bg,
        color: cfg.fg,
        padding,
        borderRadius: 999,
        fontFamily: 'var(--font-ui)',
        fontWeight: 700,
        fontSize,
        letterSpacing: '0.08em',
        border: `1px solid ${cfg.fg}33`,
      }}
    >
      <span aria-hidden="true">{cfg.glyph}</span>
      {displayLabel}
    </span>
  )
}
