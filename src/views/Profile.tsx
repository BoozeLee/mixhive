import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  follow,
  getFollowersCount,
  getFollowingCount,
  getMixesByDj,
  getPlaylistsByUser,
  getProfile,
  getProfileAnalytics,
  getProfileBadges,
  getUserActivity,
  getUserBuzzes,
  isFollowing,
  trackAnalyticsEvent,
  unfollow,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { MixCard } from '../components/MixCard';
import { BuzzCard } from '../components/BuzzCard';
import { PlaylistCard } from '../components/PlaylistCard';
import { BlockButton } from '../components/BlockButton';
import { SkeletonProfile } from '../components/Skeleton';
import { EmptyState, NotFoundState } from '../components/EmptyState';
import { VerificationBadgeSystem } from '../components/VerificationBadgeSystem';
import { VerificationRequestForm } from '../components/VerificationRequestForm';
import { ProfileAnalyticsDashboard } from '../components/ProfileAnalyticsDashboard';
import { HiveButton } from '../components/hive/HiveButton';
import { StartMythicSessionModal } from '../components/StartMythicSessionModal';
import type {
  ActivityEvent,
  Mix,
  Playlist,
  Profile as ProfileType,
  ProfileAnalytics,
  VerificationBadge,
} from '../lib/types';
import { colors, radius, space } from '../styles/tokens';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function activityText(event: ActivityEvent) {
  if (event.activity_type === 'upload')
    return (
      <>
        Uploaded{' '}
        <Link to={`/mix/${event.mix_id}`} style={{ color: colors.text.secondary }}>
          {event.mix_title}
        </Link>
      </>
    );
  if (event.activity_type === 'like')
    return (
      <>
        Liked{' '}
        <Link to={`/mix/${event.mix_id}`} style={{ color: colors.text.secondary }}>
          {event.mix_title}
        </Link>
      </>
    );
  return (
    <>
      Followed{' '}
      <Link to={`/u/${event.target_username}`} style={{ color: colors.text.secondary }}>
        {event.target_display_name || event.target_username}
      </Link>
    </>
  );
}

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [badges, setBadges] = useState<VerificationBadge[]>([]);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [buzzes, setBuzzes] = useState<import('../lib/types').FeedBuzz[]>([]);
  const [profileTab, setProfileTab] = useState<'mixes' | 'buzzes' | 'playlists'>('mixes');
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const isOwn = Boolean(user && profile?.id === user.id);
  const profileName = profile?.display_name || profile?.username || 'Profile';

  // Button for own profile to start Mythic Collab Session (Experiment 1)
  const startSessionButton = isOwn && (
    <HiveButton
      variant="primary"
      onClick={() => setShowSessionModal(true)}
      style={{ marginBottom: 16 }}
    >
      + Start Mythic Session
    </HiveButton>
  );

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    getProfile(username)
      .then(async nextProfile => {
        if (cancelled) return;
        setProfile(nextProfile);
        if (!nextProfile) {
          setLoading(false);
          return;
        }
        const [
          nextMixes,
          followerTotal,
          followingTotal,
          nextPlaylists,
          nextActivity,
          nextBadges,
          nextBuzzes,
        ] = await Promise.all([
          getMixesByDj(nextProfile.id),
          getFollowersCount(nextProfile.id),
          getFollowingCount(nextProfile.id),
          getPlaylistsByUser(nextProfile.id),
          getUserActivity(nextProfile.id),
          getProfileBadges(nextProfile.id),
          getUserBuzzes(nextProfile.id, 20),
        ]);
        if (cancelled) return;
        setMixes(nextMixes);
        setPlaylists(nextPlaylists);
        setActivity(nextActivity);
        setBuzzes(nextBuzzes.data);
        setFollowersCount(followerTotal);
        setFollowingCount(followingTotal);
        setBadges(nextBadges);
        setAnalytics(await getProfileAnalytics(nextProfile.id, nextMixes));
        if (user && user.id !== nextProfile.id) {
          setFollowing(await isFollowing(user.id, nextProfile.id));
          void trackAnalyticsEvent({
            profileId: nextProfile.id,
            actorId: user.id,
            eventType: 'profile_view',
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [username, user]);

  async function toggleFollow() {
    if (!user || !profile) return;
    if (following) {
      await unfollow(user.id, profile.id);
      setFollowersCount(prev => Math.max(0, prev - 1));
    } else {
      await follow(user.id, profile.id);
      setFollowersCount(prev => prev + 1);
      void trackAnalyticsEvent({ profileId: profile.id, actorId: user.id, eventType: 'follow' });
    }
    setFollowing(!following);
  }

  function copyProfileLink() {
    void navigator.clipboard?.writeText(window.location.href);
  }

  const milestones = useMemo(() => {
    const items: string[] = [];
    if (mixes.length >= 1) items.push('First mix published');
    if (mixes.length >= 10) items.push('10 mix streak');
    if (mixes.length >= 100) items.push('100 mixes milestone');
    if (followersCount >= 100) items.push('100 listeners in the hive');
    if (followersCount >= 1000) items.push('1,000 followers milestone');
    if (badges.length > 0 || profile?.verified) items.push('Verified profile');
    return items;
  }, [mixes.length, followersCount, badges.length, profile?.verified]);

  if (loading) return <SkeletonProfile />;
  if (!profile) return <NotFoundState what="DJ" />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px 96px' }}>
      <section style={{ marginBottom: space[11] }}>
        <div
          style={{
            width: '100%',
            height: 'clamp(200px, 32vw, 300px)',
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
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
              ♪
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: space[8],
            marginTop: -42,
            padding: '0 10px',
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
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
            }}
          >
            {!profile.avatar_url && '♪'}
          </div>
          <div style={{ flex: 1, minWidth: 220, paddingTop: 48 }}>
            <h1
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[4],
                flexWrap: 'wrap',
                margin: 0,
                fontSize: 26,
                color: colors.text.primary,
              }}
            >
              {profileName}
              <VerificationBadgeSystem profile={profile} badges={badges} />
            </h1>
            <p style={{ color: colors.text.dim, fontSize: 13, margin: '4px 0 0' }}>
              @{profile.username}
            </p>
            {profile.bio && (
              <p
                style={{
                  color: colors.text.secondary,
                  fontSize: 14,
                  lineHeight: 1.5,
                  margin: '10px 0 0',
                }}
              >
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[6], marginTop: space[8] }}>
          {profile.genres.map(genre => (
            <span
              key={genre}
              style={{
                background: colors.surfaceHover,
                color: colors.text.secondary,
                padding: '5px 10px',
                borderRadius: radius.pill,
                fontSize: 12,
              }}
            >
              {genre}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowStats(value => !value)}
          style={{
            marginTop: space[8],
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            color: colors.text.secondary,
            padding: '8px 10px',
            cursor: 'pointer',
          }}
        >
          {showStats ? 'Hide stats' : 'Show stats'}
        </button>

        {showStats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: space[5],
              marginTop: space[5],
            }}
          >
            {[
              [followersCount, 'followers'],
              [followingCount, 'following'],
              [mixes.length, 'mixes'],
              [analytics?.totalPlays || 0, 'plays'],
            ].map(([value, label]) => (
              <div
                key={label}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.lg,
                  padding: space[6],
                }}
              >
                <div style={{ color: colors.text.primary, fontWeight: 800, fontSize: 20 }}>
                  {value}
                </div>
                <div style={{ color: colors.text.dim, fontSize: 12 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[5], marginTop: space[8] }}>
          {user && !isOwn && (
            <>
              <button
                onClick={toggleFollow}
                style={{
                  minHeight: 40,
                  padding: '9px 22px',
                  borderRadius: radius.md,
                  border: following ? `1px solid ${colors.borderStrong}` : 'none',
                  background: following ? colors.surface : colors.accent,
                  color: following ? colors.text.secondary : colors.bg,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {following ? 'Following' : 'Follow'}
              </button>
              <BlockButton targetUserId={profile.id} currentUserId={user.id} />
            </>
          )}
          {isOwn && (
            <>
              <Link
                to="/settings"
                style={{
                  minHeight: 40,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '9px 22px',
                  borderRadius: radius.md,
                  border: `1px solid ${colors.borderStrong}`,
                  color: colors.text.secondary,
                  textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                Edit Profile
              </Link>
              <Link
                to="/upload"
                style={{
                  minHeight: 40,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '9px 22px',
                  borderRadius: radius.md,
                  background: colors.accent,
                  color: colors.bg,
                  textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                Upload Mix
              </Link>
              {startSessionButton}
              {profile.is_admin && (
                <Link
                  to="/admin/verification"
                  style={{
                    minHeight: 40,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '9px 22px',
                    borderRadius: radius.md,
                    border: `1px solid ${colors.borderStrong}`,
                    color: colors.text.secondary,
                    textDecoration: 'none',
                    fontWeight: 700,
                  }}
                >
                  Verification Admin
                </Link>
              )}
            </>
          )}
          <button
            type="button"
            onClick={copyProfileLink}
            style={{
              minHeight: 40,
              padding: '9px 18px',
              borderRadius: radius.md,
              border: `1px solid ${colors.borderStrong}`,
              background: colors.surface,
              color: colors.text.secondary,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Copy link
          </button>
        </div>
      </section>

      {isOwn && <VerificationRequestForm profile={profile} />}
      {analytics && (
        <ProfileAnalyticsDashboard analytics={analytics} profileName={profile.username} />
      )}

      {(activity.length > 0 || milestones.length > 0) && (
        <section style={{ marginBottom: space[12] }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.text.primary,
              marginBottom: space[6],
            }}
          >
            Activity
          </h2>
          <div style={{ display: 'grid', gap: space[4] }}>
            {milestones.map(item => (
              <div
                key={item}
                style={{
                  color: colors.accent,
                  fontSize: 13,
                  background: `linear-gradient(135deg, ${colors.surface}, ${colors.accentFaint})`,
                  border: `1px solid ${colors.accentMuted}`,
                  borderRadius: radius.md,
                  padding: space[5],
                }}
              >
                ◆ {item}
              </div>
            ))}
            {activity.slice(0, 8).map((event, index) => (
              <div
                key={`${event.created_at}-${index}`}
                style={{
                  display: 'flex',
                  gap: space[4],
                  color: colors.text.muted,
                  fontSize: 13,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: space[5],
                }}
              >
                <span aria-hidden="true">
                  {event.activity_type === 'upload'
                    ? '♪'
                    : event.activity_type === 'like'
                      ? '♥'
                      : '+'}
                </span>
                <span style={{ flex: 1 }}>{activityText(event)}</span>
                <span style={{ color: colors.text.dim }}>{timeAgo(event.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Content tabs: Mixes / Buzzes / Playlists */}
      <section>
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: space[8],
            background: '#111',
            borderRadius: 10,
            padding: 4,
          }}
        >
          {(['mixes', 'buzzes', 'playlists'] as const).map(t => (
            <button
              key={t}
              onClick={() => setProfileTab(t)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: profileTab === t ? '#f0c040' : 'transparent',
                color: profileTab === t ? '#0a0a0a' : '#666',
                fontWeight: profileTab === t ? 700 : 400,
                cursor: 'pointer',
                fontSize: 13,
                textTransform: 'capitalize',
              }}
            >
              {t === 'mixes'
                ? `Mixes (${mixes.length})`
                : t === 'buzzes'
                  ? `Buzzes (${buzzes.length})`
                  : `Playlists (${playlists.length})`}
            </button>
          ))}
        </div>

        {profileTab === 'mixes' &&
          (mixes.length === 0 ? (
            <EmptyState
              icon="◆"
              title={isOwn ? 'Drop the first mix' : 'No mixes in this hive yet'}
              body={
                isOwn
                  ? 'Start the booth with a fresh upload and your first Honey Drop stats card.'
                  : 'This DJ has not published a mix yet.'
              }
              actionLabel={isOwn ? 'Upload mix' : undefined}
              actionTo={isOwn ? '/upload' : undefined}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                gap: space[6],
                overflowX: 'auto',
                paddingBottom: space[5],
                scrollSnapType: 'x mandatory',
              }}
            >
              {mixes.map(mix => (
                <div
                  key={mix.id}
                  style={{ minWidth: 'min(420px, 88vw)', scrollSnapAlign: 'start' }}
                >
                  <MixCard
                    mix={{
                      ...mix,
                      dj_username: profile.username,
                      dj_display_name: profile.display_name || profile.username,
                      dj_avatar_url: profile.avatar_url || '',
                      genre_name: mix.genre_name || null,
                      weekly_plays: mix.weekly_plays || 0,
                    }}
                  />
                </div>
              ))}
            </div>
          ))}

        {profileTab === 'buzzes' &&
          (buzzes.length === 0 ? (
            <EmptyState
              icon="🐝"
              title="No buzzes yet"
              body={isOwn ? 'Post your first buzz from the feed.' : 'This DJ has not buzzed yet.'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
              {buzzes.map(b => (
                <BuzzCard
                  key={b.id}
                  buzz={b}
                  onDeleted={id => setBuzzes(prev => prev.filter(x => x.id !== id))}
                />
              ))}
            </div>
          ))}

        {profileTab === 'playlists' &&
          (playlists.length === 0 ? (
            <p style={{ color: colors.text.dim, fontSize: 14 }}>No playlists yet</p>
          ) : (
            <div style={{ display: 'grid', gap: space[6] }}>
              {playlists.map(playlist => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          ))}
      </section>

      <StartMythicSessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />
    </div>
  );
}
