import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'react-router-dom';
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
import { SkeletonProfile } from '../components/Skeleton';
import { EmptyState, NotFoundState } from '../components/EmptyState';
import { ProfileAnalyticsDashboard } from '../components/ProfileAnalyticsDashboard';
import { HiveStory } from '../views/HiveStory';
import { SimilarArtistsPanel } from '../components/SimilarArtistsPanel';
import { StartMythicSessionModal } from '../components/StartMythicSessionModal';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileTabs, type ProfileTab } from '../components/profile/ProfileTabs';
import { FeaturedMixHero } from '../components/profile/FeaturedMixHero';
import { AboutTab } from '../components/profile/AboutTab';
import { ActivityTab } from '../components/profile/ActivityTab';
import { AgentsTab } from '../components/profile/AgentsTab';
import { EventsTab } from '../components/profile/EventsTab';
import { maybeAnnounceXpGain } from '../lib/xpToast';
import { space } from '../styles/tokens';
import type {
  ActivityEvent,
  Mix,
  Playlist,
  Profile as ProfileType,
  ProfileAnalytics,
  VerificationBadge,
} from '../lib/types';

export function ProfilePage() {
  const t = useTranslations('profile');
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [badges, setBadges] = useState<VerificationBadge[]>([]);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [buzzes, setBuzzes] = useState<import('../lib/types').FeedBuzz[]>([]);
  const [profileTab, setProfileTab] = useState<ProfileTab>('mixes');
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const isOwn = Boolean(user && profile?.id === user.id);

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
        } else if (user && user.id === nextProfile.id) {
          maybeAnnounceXpGain(user.id, nextProfile.xp ?? 0, nextProfile.level ?? 1);
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
    if (mixes.length >= 1) items.push(t('milestoneFirstMix'));
    if (mixes.length >= 10) items.push(t('milestoneTenMixes'));
    if (mixes.length >= 100) items.push(t('milestoneHundredMixes'));
    if (followersCount >= 100) items.push(t('milestoneHundredListeners'));
    if (followersCount >= 1000) items.push(t('milestoneThousandListeners'));
    if (badges.length > 0 || profile?.verified) items.push(t('milestoneVerified'));
    return items;
  }, [mixes.length, followersCount, badges.length, profile?.verified, t]);

  const tabs = useMemo(
    () => [
      { id: 'mixes' as const, label: t('tabMixes'), count: mixes.length, icon: 'mix' as const },
      { id: 'buzzes' as const, label: t('tabBuzzes'), count: buzzes.length, icon: 'buzz' as const },
      {
        id: 'playlists' as const,
        label: t('tabPlaylists'),
        count: playlists.length,
        icon: 'music' as const,
      },
      { id: 'story' as const, label: t('tabStory'), icon: 'story' as const },
      { id: 'activity' as const, label: t('tabActivity'), icon: 'feed' as const },
      { id: 'agents' as const, label: t('tabAgents'), icon: 'agents' as const },
      { id: 'events' as const, label: t('tabEvents'), icon: 'events' as const },
      { id: 'about' as const, label: t('tabAbout'), icon: 'profile' as const },
    ],
    [t, mixes.length, buzzes.length, playlists.length]
  );

  const featuredMix = mixes.length > 0 ? mixes[0] : null;

  if (loading) return <SkeletonProfile />;
  if (!profile) return <NotFoundState what="DJ" />;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 12px 96px' }}>
      <ProfileHeader
        profile={profile}
        badges={badges}
        analytics={analytics}
        followersCount={followersCount}
        followingCount={followingCount}
        mixesCount={mixes.length}
        following={following}
        isOwn={isOwn}
        onToggleFollow={toggleFollow}
        onCopyLink={copyProfileLink}
        onStartSession={() => setShowSessionModal(true)}
      />

      {analytics && (
        <ProfileAnalyticsDashboard analytics={analytics} profileName={profile.username} />
      )}

      {featuredMix && <FeaturedMixHero mix={featuredMix} profile={profile} />}

      <SimilarArtistsPanel profileId={profile.id} />

      <section>
        <ProfileTabs tabs={tabs} activeTab={profileTab} onChange={setProfileTab} />

        {profileTab === 'mixes' &&
          (mixes.length === 0 ? (
            <EmptyState
              iconKey="mix"
              title={isOwn ? t('noMixesTitleOwn') : t('noMixesTitleOther')}
              body={isOwn ? t('noMixesBodyOwn') : t('noMixesBodyOther')}
              actionLabel={isOwn ? t('noMixesAction') : undefined}
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
              iconKey="buzz"
              title={t('noBuzzes')}
              body={isOwn ? t('noBuzzesBodyOwn') : t('noBuzzesBodyOther')}
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
            <EmptyState
              iconKey="music"
              title={t('noPlaylistsTitle')}
              body={isOwn ? t('noPlaylistsBodyOwn') : t('noPlaylistsBodyOther')}
            />
          ) : (
            <div style={{ display: 'grid', gap: space[6] }}>
              {playlists.map(playlist => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          ))}

        {profileTab === 'story' && (
          <HiveStory
            profileId={profile.id}
            showJourney={
              ((profile as unknown as Record<string, unknown>)?.show_journey as boolean) ?? false
            }
            isOwn={isOwn}
          />
        )}

        {profileTab === 'activity' && <ActivityTab activity={activity} milestones={milestones} />}

        {profileTab === 'agents' && <AgentsTab isOwn={isOwn} />}

        {profileTab === 'events' && <EventsTab />}

        {profileTab === 'about' && <AboutTab profile={profile} />}
      </section>

      <StartMythicSessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />
    </div>
  );
}
