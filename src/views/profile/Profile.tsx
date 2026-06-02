'use client';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { usePlayer } from '@/lib/player-store';

interface ProfileData {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  genres: string[];
  social_links: {
    instagram?: string;
    twitter?: string;
    soundcloud?: string;
    website?: string;
  };
  avatar_url?: string;
  banner_url?: string;
  created_at: string;
  stats: {
    mixes_count: number;
    followers_count: number;
    following_count: number;
  };
  recent_mixes: Array<{
    id: string;
    title: string;
    artwork_url?: string;
    created_at: string;
    plays_count: number;
  }>;
}

export function Profile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const { playTrack } = usePlayer();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) {
        setError('Profile ID is required');
        setLoading(false);
        return;
      }

      try {
        // TODO: Replace with actual API call
        const mockProfile: ProfileData = {
          id: id,
          username: 'dj_example',
          display_name: 'DJ Example',
          bio: 'Spinning the best techno and house music in the underground scene. Bringing you the beats that make you move.',
          genres: ['Techno', 'House', 'Minimal'],
          social_links: {
            instagram: '@djexample',
            twitter: '@djexample',
            soundcloud: 'djexample',
            website: 'https://djexample.com',
          },
          avatar_url: undefined,
          banner_url: undefined,
          created_at: '2024-01-01T00:00:00Z',
          stats: {
            mixes_count: 24,
            followers_count: 1245,
            following_count: 89,
          },
          recent_mixes: [
            {
              id: '1',
              title: 'Underground Techno Mix',
              artwork_url: undefined,
              created_at: '2024-01-15T00:00:00Z',
              plays_count: 3420,
            },
            {
              id: '2',
              title: 'Deep House Session',
              artwork_url: undefined,
              created_at: '2024-01-10T00:00:00Z',
              plays_count: 2150,
            },
            {
              id: '3',
              title: 'Minimal Beats',
              artwork_url: undefined,
              created_at: '2024-01-05T00:00:00Z',
              plays_count: 1890,
            },
          ],
        };

        setProfile(mockProfile);

        // TODO: Check if current user is following this profile
        setIsFollowing(false);
      } catch (err) {
        setError('Failed to load profile');
        console.error('Profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  const handleFollow = async () => {
    if (!profile) return;

    try {
      // TODO: Implement follow/unfollow API call
      setIsFollowing(!isFollowing);

      // Update stats
      setProfile(prev =>
        prev
          ? {
              ...prev,
              stats: {
                ...prev.stats,
                followers_count: isFollowing
                  ? prev.stats.followers_count - 1
                  : prev.stats.followers_count + 1,
              },
            }
          : null
      );
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  const handlePlayMix = (mixId: string) => {
    // TODO: Implement actual mix playback
    console.log('Playing mix:', mixId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-2xl text-red-400 mb-2">Error</h1>
          <p className="text-gray-400">{error || 'Profile not found'}</p>
          <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 btn btn-secondary">
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Profile Banner */}
      <div
        className="h-64 bg-cover bg-center relative"
        style={{
          backgroundImage: profile.banner_url
            ? `url(${profile.banner_url})`
            : 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="absolute top-4 left-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-300 hover:text-white transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <div className="bg-gray-900 rounded-lg p-6 shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            {/* Avatar */}
            <div
              className="w-24 h-24 rounded-full border-4 border-yellow-400 bg-gray-800 flex items-center justify-center"
              style={{
                backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {!profile.avatar_url && <span className="text-2xl text-gray-400">👤</span>}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{profile.display_name}</h1>
                  <p className="text-gray-400 mb-2">@{profile.username}</p>
                  <p className="text-gray-300">{profile.bio}</p>
                </div>

                <div className="flex space-x-3 mt-4 md:mt-0">
                  <button
                    onClick={handleFollow}
                    className={`px-6 py-2 rounded-full font-medium transition-colors ${
                      isFollowing
                        ? 'bg-gray-800 text-white hover:bg-gray-700'
                        : 'bg-yellow-400 text-black hover:bg-yellow-300'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>

                  {isFollowing && (
                    <button
                      onClick={() => navigate(`/u/${profile.username}/edit`)}
                      className="px-6 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex space-x-6 mt-4 justify-center md:justify-start">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{profile.stats.mixes_count}</p>
                  <p className="text-gray-400 text-sm">Mixes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{profile.stats.followers_count}</p>
                  <p className="text-gray-400 text-sm">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{profile.stats.following_count}</p>
                  <p className="text-gray-400 text-sm">Following</p>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex space-x-4 mt-4 justify-center md:justify-start">
                {profile.social_links.instagram && (
                  <a
                    href={`https://instagram.com/${profile.social_links.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-yellow-400 transition-colors"
                  >
                    📷 Instagram
                  </a>
                )}
                {profile.social_links.twitter && (
                  <a
                    href={`https://twitter.com/${profile.social_links.twitter.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-yellow-400 transition-colors"
                  >
                    🐦 Twitter
                  </a>
                )}
                {profile.social_links.soundcloud && (
                  <a
                    href={`https://soundcloud.com/${profile.social_links.soundcloud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-yellow-400 transition-colors"
                  >
                    🎵 SoundCloud
                  </a>
                )}
                {profile.social_links.website && (
                  <a
                    href={profile.social_links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-yellow-400 transition-colors"
                  >
                    🌐 Website
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Genres */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-3">Genres</h3>
            <div className="flex flex-wrap gap-2">
              {profile.genres.map(genre => (
                <span
                  key={genre}
                  className="px-3 py-1 bg-yellow-400 text-black rounded-full text-sm font-medium"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Mixes */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-6">Recent Mixes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profile.recent_mixes.map(mix => (
              <div
                key={mix.id}
                className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => handlePlayMix(mix.id)}
              >
                <div
                  className="h-48 bg-cover bg-center"
                  style={{
                    backgroundImage: mix.artwork_url
                      ? `url(${mix.artwork_url})`
                      : 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
                  }}
                >
                  <div className="w-full h-full bg-black bg-opacity-40 flex items-center justify-center">
                    <div className="text-4xl">▶️</div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">{mix.title}</h3>
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>{new Date(mix.created_at).toLocaleDateString()}</span>
                    <span>🎵 {mix.plays_count.toLocaleString()} plays</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
