import type { Profile, VerificationBadge } from '../lib/types'
import { colors, radius, space } from '../styles/tokens'

const badgeMeta = {
  verified: { icon: '✓', label: 'Verified', title: 'Verified DJ profile' },
  artist: { icon: '♪', label: 'Artist', title: 'Verified artist account' },
  official: { icon: '★', label: 'Official', title: 'Official representative account' },
} as const

interface Props {
  profile: Profile
  badges: VerificationBadge[]
  compact?: boolean
}

export function VerificationBadgeSystem({ profile, badges, compact = false }: Props) {
  const effectiveBadges = badges.length > 0
    ? badges
    : profile.verified
      ? [{
          id: 'legacy-verified',
          profile_id: profile.id,
          badge_type: 'verified' as const,
          label: 'Verified',
          reason: 'Legacy verified profile',
          granted_by: null,
          granted_at: profile.updated_at || profile.created_at,
          expires_at: null,
        }]
      : []

  if (effectiveBadges.length === 0) return null

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
      {effectiveBadges.map(badge => {
        const meta = badgeMeta[badge.badge_type]
        const title = `${meta.title}${badge.reason ? `: ${badge.reason}` : ''}`
        return (
          <span
            key={`${badge.id}-${badge.badge_type}`}
            title={title}
            aria-label={title}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: compact ? 0 : space[2],
              minHeight: compact ? 20 : 24,
              padding: compact ? '2px 6px' : '3px 8px',
              borderRadius: radius.pill,
              background: badge.badge_type === 'official' ? colors.accent : colors.surfaceHover,
              color: badge.badge_type === 'official' ? colors.bg : colors.accent,
              border: `1px solid ${badge.badge_type === 'official' ? colors.accent : colors.accentMuted}`,
              fontSize: compact ? 11 : 12,
              fontWeight: 700,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden="true">{meta.icon}</span>
            {!compact && <span>{badge.label || meta.label}</span>}
          </span>
        )
      })}
    </span>
  )
}
