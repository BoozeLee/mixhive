import { ProfilePictureUpload } from './ProfilePictureUpload';
import { Icon } from './ui/Icon';
import type { IconKey } from '../lib/icons';
import { ProfileBannerUpload } from './ProfileBannerUpload';
import { useAuth } from '../hooks/useAuth';
import type { Profile } from '../lib/types';
import { PortfolioEmbeds } from './PortfolioEmbeds';

interface EnhancedProfileHeaderProps {
  profile: Profile | null;
  followersCount: number;
  followingCount: number;
  mixesCount: number;
  isOwnProfile: boolean;
}

export function EnhancedProfileHeader({
  profile,
  followersCount,
  followingCount,
  mixesCount,
  isOwnProfile,
}: EnhancedProfileHeaderProps) {
  const { user } = useAuth();
  const handleBannerUploadComplete = () => {
    // Update the profile with new banner URL
    if (user && profile) {
      window.location.reload(); // Simple way to refresh and show updated banner
    }
  };

  const handleAvatarUploadComplete = () => {
    // Update the profile with new avatar URL
    if (profile) {
      window.location.reload(); // Simple way to refresh and show updated avatar
    }
  };

  if (!profile) return null;

  return (
    <div className="relative">
      {/* Banner Section */}
      <div className="relative h-64 w-full overflow-hidden">
        {profile.banner_url ? (
          <img
            src={profile.banner_url}
            alt="Profile Banner"
            className="w-full h-full object-cover"
            onError={e => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/50 via-blue-900/50 to-indigo-900/50 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="mb-2" style={{ display: 'inline-flex' }}>
                <Icon name="music" size={36} />
              </div>
              <div className="text-lg">Profile Banner</div>
            </div>
          </div>
        )}

        {/* Banner Upload Overlay */}
        {isOwnProfile && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <ProfileBannerUpload
              profile={profile}
              currentUserId={user?.id || ''}
              onUploadComplete={handleBannerUploadComplete}
              className="w-full h-full"
            />
          </div>
        )}

        {/* Top Right Edit Button */}
        {isOwnProfile && (
          <div className="absolute top-4 right-4">
            <button className="bg-black/60 text-white px-3 py-1 rounded-lg text-sm hover:bg-black/80 transition-colors">
              Edit Banner
            </button>
          </div>
        )}
      </div>

      {/* Profile Info Section */}
      <div className="relative px-6 pb-8">
        {/* Avatar with Shadow */}
        <div className="absolute -top-16 left-6">
          <div className="relative">
            <ProfilePictureUpload
              profile={profile}
              currentUserId={user?.id || ''}
              onUploadComplete={handleAvatarUploadComplete}
              size="large"
            />
            {/* Avatar Shadow Effect */}
            <div className="absolute inset-0 bg-black/20 rounded-full blur-sm -z-10"></div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="pt-16">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="flex items-center gap-3 text-2xl font-bold text-white mb-2">
                <span>{profile.display_name || profile.username}</span>
                {profile.verified && <span className="text-blue-400 text-xl">✓</span>}
              </h1>
              <p className="text-gray-400 text-sm mb-3">@{profile.username}</p>

              {profile.bio && (
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">{profile.bio}</p>
              )}

              {profile.location && (
                <p className="text-gray-500 text-sm mb-3">📍 {profile.location}</p>
              )}

              {/* Genre Tags */}
              {profile.genres && profile.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {profile.genres.map(g => (
                    <span
                      key={g}
                      className="bg-purple-900/50 text-purple-300 px-3 py-1 rounded-full text-xs font-medium border border-purple-700/50"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Social Links */}
              {profile.social_links && Object.keys(profile.social_links).length > 0 && (
                <div className="flex gap-3 mb-4">
                  {Object.entries(profile.social_links).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                      title={platform}
                    >
                      <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                        <Icon name={getPlatformIcon(platform)} size={16} color="currentColor" />
                      </div>
                    </a>
                  ))}
                </div>
              )}

              <PortfolioEmbeds links={profile.social_links as Record<string, string> | null} />
            </div>

            {/* Stats */}
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-xl font-bold text-white">{mixesCount}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Mixes</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">{followersCount}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Followers</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">{followingCount}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Following</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <div className="flex gap-3 mt-4">
              <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Follow
              </button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Message
              </button>
            </div>
          )}

          {isOwnProfile && (
            <div className="flex gap-3 mt-4">
              <a
                href="/settings"
                className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors inline-block"
              >
                Edit Profile
              </a>
              <a
                href="/upload"
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors inline-block"
              >
                Upload Mix
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getPlatformIcon(platform: string): IconKey {
  const icons: Record<string, IconKey> = {
    soundcloud: 'music',
    spotify: 'headphones',
    youtube: 'video',
    applemusic: 'music',
    mixcloud: 'headphones',
    tiktok: 'video',
    bandcamp: 'music',
    beatport: 'music',
    instagram: 'camera',
    website: 'link',
    twitter: 'external',
    facebook: 'external',
  };
  return icons[platform.toLowerCase()] || 'link';
}
