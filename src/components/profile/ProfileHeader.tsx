import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../hooks/useAuth';
import { VerificationBadgeSystem } from '../VerificationBadgeSystem';
import { VerificationRequestForm } from '../VerificationRequestForm';
import { HiveStanding } from '../HiveStanding';
import { BlockButton } from '../BlockButton';
import { MessageButton } from '../MessageButton';
import { ReportButton } from '../ReportButton';
import { HiveButton } from '../hive/HiveButton';
import { FoundingMemberBadge } from '../FoundingMemberBadge';
import { Icon } from '../ui/Icon';
import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';
import type { Profile as ProfileType, VerificationBadge, ProfileAnalytics } from '../../lib/types';

interface ProfileHeaderProps {
  profile: ProfileType;
  badges: VerificationBadge[];
  analytics: ProfileAnalytics | null;
  followersCount: number;
  followingCount: number;
  mixesCount: number;
  following: boolean;
  isOwn: boolean;
  onToggleFollow: () => void;
  onCopyLink: () => void;
  onStartSession: () => void;
}

export function ProfileHeader({
  profile,
  badges,
  analytics,
  followersCount,
  followingCount,
  mixesCount,
  following,
  isOwn,
  onToggleFollow,
  onCopyLink,
  onStartSession,
}: ProfileHeaderProps) {
  const t = useTranslations('profile');
  const { user } = useAuth();
  const profileName = profile.display_name || profile.username;

  const stats = [
    { value: followersCount, label: t('followers') },
    { value: followingCount, label: t('followingCount') },
    { value: mixesCount, label: t('mixes') },
    { value: analytics?.totalPlays || 0, label: t('plays') },
  ];

  return (
    <section style={{ marginBottom: space[11] }}>
      {/* Banner */}
      <div
        style={{
          width: '100%',
          height: 'clamp(160px, 28vw, 260px)',
          borderRadius: radius.lg,
          overflow: 'hidden',
          position: 'relative',
          background: `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})`,
        }}
      >
        {profile.banner_url ? (
          <img
            src={profile.banner_url}
            alt={`${profileName} banner`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.accentMuted,
              fontSize: 48,
            }}
          >
            <Icon name="music" size={48} color="currentColor" />
          </div>
        )}
      </div>

      {/* Avatar + identity row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: space[7],
          marginTop: -40,
          padding: `0 ${space[5]}px`,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.full,
            background: profile.avatar_url
              ? `url(${profile.avatar_url}) center/cover`
              : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})`,
            border: `4px solid ${colors.bg}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.accentMuted,
            fontSize: 30,
            overflow: 'hidden',
          }}
        >
          {!profile.avatar_url && <Icon name="profile" size={36} color="currentColor" />}
        </div>

        <div style={{ flex: 1, minWidth: 200, paddingTop: 32 }}>
          <h1
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[4],
              flexWrap: 'wrap',
              margin: 0,
              fontSize: 26,
              color: colors.text.primary,
              fontFamily: 'var(--font-display, system-ui)',
            }}
          >
            {profileName}
            <VerificationBadgeSystem profile={profile} badges={badges} />
            {profile.is_founding_member && <FoundingMemberBadge />}

            {/* XP & Level Badge */}
            <div
              style={{
                background: 'rgba(255, 191, 0, 0.1)',
                border: '1px solid rgba(255, 191, 0, 0.3)',
                padding: '2px 8px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginLeft: 8,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: colors.accent }}>
                LVL {profile.level || 1}
              </span>
              <div
                style={{ width: 40, height: 4, background: colors.surfaceHover, borderRadius: 4 }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (profile.xp || 0) % 100)}%`,
                    height: '100%',
                    background: colors.accent,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 4,
            }}
          >
            <p style={{ color: colors.text.dim, fontSize: 13, margin: 0 }}>@{profile.username}</p>
          </div>
          {profile.location && (
            <p style={{ color: colors.text.dim, fontSize: 13, margin: '4px 0 0' }}>
              📍 {profile.location}
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio ? (
        <p
          style={{
            color: colors.text.secondary,
            fontSize: fontSize.md,
            lineHeight: 1.5,
            margin: `${space[6]}px 0 0`,
          }}
        >
          {profile.bio}
        </p>
      ) : (
        <p
          style={{
            color: colors.text.dim,
            fontSize: fontSize.md,
            fontStyle: 'italic',
            margin: `${space[6]}px 0 0`,
          }}
        >
          {t('emptyBio')}
        </p>
      )}

      {/* Genres */}
      {profile.genres.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4], marginTop: space[6] }}>
          {profile.genres.map(genre => (
            <span
              key={genre}
              style={{
                background: colors.surfaceHover,
                color: colors.text.secondary,
                padding: '5px 10px',
                borderRadius: radius.pill,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
              }}
            >
              {genre}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: space[4],
          marginTop: space[8],
        }}
      >
        {stats.map(({ value, label }) => (
          <div
            key={label}
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: `${space[5]}px ${space[6]}px`,
              textAlign: 'center',
            }}
          >
            <div style={{ color: colors.text.primary, fontWeight: fontWeight.bold, fontSize: 20 }}>
              {value}
            </div>
            <div style={{ color: colors.text.dim, fontSize: fontSize.sm }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Hive standing */}
      <HiveStanding
        xp={profile.xp ?? null}
        level={profile.level ?? null}
        reputationScore={profile.reputation_score ?? null}
      />

      {/* Action row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4], marginTop: space[8] }}>
        {user && !isOwn && (
          <>
            <HiveButton
              variant={following ? 'glass' : 'primary'}
              onClick={onToggleFollow}
              style={{ minHeight: 40 }}
            >
              {following ? t('following') : t('follow')}
            </HiveButton>
            <MessageButton targetUserId={profile.id} />
            <BlockButton targetUserId={profile.id} currentUserId={user.id} />
            <ReportButton sourceTable="profiles" sourceId={profile.id} />
          </>
        )}
        {isOwn && (
          <>
            <Link to="/settings" style={{ textDecoration: 'none' }}>
              <HiveButton variant="glass" style={{ minHeight: 40 }}>
                {t('editProfile')}
              </HiveButton>
            </Link>
            <Link to="/upload" style={{ textDecoration: 'none' }}>
              <HiveButton variant="primary" style={{ minHeight: 40 }}>
                {t('uploadMix')}
              </HiveButton>
            </Link>
            <HiveButton variant="glass" onClick={onStartSession} style={{ minHeight: 40 }}>
              + {t('startMythicSession')}
            </HiveButton>
            {profile.is_admin && (
              <Link to="/admin/verification" style={{ textDecoration: 'none' }}>
                <HiveButton variant="glass" style={{ minHeight: 40 }}>
                  {t('verificationAdmin')}
                </HiveButton>
              </Link>
            )}
            {profile.is_admin && (
              <Link to="/admin/moderation" style={{ textDecoration: 'none' }}>
                <HiveButton variant="glass" style={{ minHeight: 40 }}>
                  {t('moderation')}
                </HiveButton>
              </Link>
            )}
            {profile.is_admin && (
              <Link to="/admin/users" style={{ textDecoration: 'none' }}>
                <HiveButton variant="glass" style={{ minHeight: 40 }}>
                  Users
                </HiveButton>
              </Link>
            )}
          </>
        )}
        <HiveButton variant="ghost" onClick={onCopyLink} style={{ minHeight: 40 }}>
          {t('copyLink')}
        </HiveButton>
      </div>

      {isOwn && <VerificationRequestForm profile={profile} />}
    </section>
  );
}
