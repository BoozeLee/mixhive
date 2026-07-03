import { Link } from 'react-router-dom';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';
import type { Profile } from '../../lib/types';

interface CreatorCardProps {
  profile: Profile;
}

export function CreatorCard({ profile }: CreatorCardProps) {
  return (
    <Link
      to={`/u/${profile.username}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        flexShrink: 0,
        width: 160,
        scrollSnapAlign: 'start',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: space[4],
          padding: space[6],
          background: colors.surface,
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          transition: `border-color ${transition.fast}`,
          height: '100%',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = colors.accentMuted)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            background: profile.avatar_url ? undefined : `${colors.accentMuted}44`,
            overflow: 'hidden',
            border: `2px solid ${colors.accentMuted}`,
            flexShrink: 0,
          }}
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name || profile.username}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                color: colors.accentMuted,
              }}
            >
              🐝
            </div>
          )}
        </div>

        <div style={{ minWidth: 0, width: '100%' }}>
          <div
            style={{
              fontSize: fontSize.md,
              fontWeight: fontWeight.semibold,
              color: colors.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={profile.display_name || profile.username}
          >
            {profile.display_name || profile.username}
          </div>
          <div
            style={{
              fontSize: fontSize.sm,
              color: colors.text.muted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            @{profile.username}
          </div>
          {(profile.followers_count ?? 0) > 0 && (
            <div style={{ fontSize: fontSize.sm, color: colors.text.dim, marginTop: space[2] }}>
              <span style={{ fontWeight: fontWeight.semibold, color: colors.text.secondary }}>
                {profile.followers_count}
              </span>{' '}
              followers
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
