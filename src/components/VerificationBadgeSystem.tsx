import type { Profile, VerificationBadge } from '../lib/types';
import { colors, radius, space } from '../styles/tokens';
import { Icon } from './ui/Icon';
import type { IconKey } from '../lib/icons';

const badgeMeta = {
  verified: { icon: 'verified', label: 'Verified', title: 'Verified DJ profile' },
  artist: { icon: 'music', label: 'Artist', title: 'Verified artist account' },
  official: { icon: 'rating', label: 'Official', title: 'Official representative account' },
  trusted_seller: {
    icon: 'package',
    label: 'Trusted Seller',
    title: 'Trusted seller — multiple dispute-free sales',
  },
} as const satisfies Record<string, { icon: IconKey; label: string; title: string }>;

function badgeColors(type: keyof typeof badgeMeta) {
  if (type === 'official') {
    return { background: colors.accent, color: colors.bg, border: colors.accent };
  }
  if (type === 'trusted_seller') {
    return { background: colors.surfaceHover, color: colors.success, border: colors.success };
  }
  return { background: colors.surfaceHover, color: colors.accent, border: colors.accentMuted };
}

interface Props {
  /** Optional — only needed for the legacy `profile.verified` fallback. List
   *  surfaces (gear/agent cards) pass real badge rows and omit it. */
  profile?: Profile;
  badges: VerificationBadge[];
  compact?: boolean;
}

export function VerificationBadgeSystem({ profile, badges, compact = false }: Props) {
  const effectiveBadges =
    badges.length > 0
      ? badges
      : profile?.verified
        ? [
            {
              id: 'legacy-verified',
              profile_id: profile.id,
              badge_type: 'verified' as const,
              label: 'Verified',
              reason: 'Legacy verified profile',
              granted_by: null,
              granted_at: profile.updated_at || profile.created_at,
              expires_at: null,
            },
          ]
        : [];

  if (effectiveBadges.length === 0) return null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
      {effectiveBadges.map(badge => {
        const meta = badgeMeta[badge.badge_type];
        const tone = badgeColors(badge.badge_type);
        const title = `${meta.title}${badge.reason ? `: ${badge.reason}` : ''}`;
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
              background: tone.background,
              color: tone.color,
              border: `1px solid ${tone.border}`,
              fontSize: compact ? 11 : 12,
              fontWeight: 700,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden="true" style={{ display: 'inline-flex' }}><Icon name={meta.icon} size={13} color="currentColor" /></span>
            {!compact && <span>{badge.label || meta.label}</span>}
          </span>
        );
      })}
    </span>
  );
}
