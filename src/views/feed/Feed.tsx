'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CDNOptimizedImage } from '@/components/CDNOptimizedImage';

interface Mix {
  id: string;
  title: string;
  description: string;
  genre: string;
  artwork_url?: string;
  plays_count: number;
  likes_count: number;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface BuzzPost {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  likes_count: number;
  comments_count: number;
  shares_count: number;
}

export function Feed() {
  const [activeTab, setActiveTab] = useState<'mixes' | 'buzz'>('mixes');
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [buzzPosts, setBuzzPosts] = useState<BuzzPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchContent();
  }, [activeTab]);

  const fetchContent = async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'mixes') {
        // TODO: Replace with actual API call
        const mockMixes: Mix[] = [
          {
            id: '1',
            title: 'Underground Techno Mix',
            description: 'Dark driving beats and atmospheric pads',
            genre: 'Techno',
            artwork_url: undefined,
            plays_count: 3420,
            likes_count: 245,
            created_at: '2024-01-15T00:00:00Z',
            user: {
              id: '1',
              username: 'dj_example',
              display_name: 'DJ Example',
              avatar_url: undefined,
            },
          },
          {
            id: '2',
            title: 'Deep House Session',
            description: 'Smooth grooves and soulful vibes',
            genre: 'House',
            artwork_url: undefined,
            plays_count: 2150,
            likes_count: 189,
            created_at: '2024-01-14T00:00:00Z',
            user: {
              id: '2',
              username: 'house_master',
              display_name: 'House Master',
              avatar_url: undefined,
            },
          },
          {
            id: '3',
            title: 'Minimal Beats',
            description: 'Clean and precise electronic rhythms',
            genre: 'Minimal',
            artwork_url: undefined,
            plays_count: 1890,
            likes_count: 156,
            created_at: '2024-01-13T00:00:00Z',
            user: {
              id: '3',
              username: 'minimal_dj',
              display_name: 'Minimal DJ',
              avatar_url: undefined,
            },
          },
        ];
        setMixes(mockMixes);
      } else {
        // TODO: Replace with actual API call
        const mockBuzzPosts: BuzzPost[] = [
          {
            id: '1',
            content: 'Just dropped my new techno mix! Hope you enjoy the journey 🎵🔥',
            created_at: '2024-01-15T00:00:00Z',
            user: {
              id: '1',
              username: 'dj_example',
              display_name: 'DJ Example',
              avatar_url: undefined,
            },
            likes_count: 42,
            comments_count: 8,
            shares_count: 3,
          },
          {
            id: '2',
            content: 'Amazing night at the club last night! The energy was incredible ✨',
            created_at: '2024-01-14T00:00:00Z',
            user: {
              id: '2',
              username: 'club_dj',
              display_name: 'Club DJ',
              avatar_url: undefined,
            },
            likes_count: 28,
            comments_count: 5,
            shares_count: 1,
          },
          {
            id: '3',
            content:
              "Looking for collaborators for a new project. Hit me up if you're into experimental electronic music 🎛️",
            created_at: '2024-01-13T00:00:00Z',
            user: {
              id: '3',
              username: 'experimental_producer',
              display_name: 'Experimental Producer',
              avatar_url: undefined,
            },
            likes_count: 15,
            comments_count: 12,
            shares_count: 2,
          },
        ];
        setBuzzPosts(mockBuzzPosts);
      }
    } catch (err) {
      setError('Failed to load content');
      console.error('Content fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-yellow-400">MIXHIVE</h1>
            <div className="flex items-center space-x-6">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('mixes')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'mixes'
                      ? 'text-yellow-400 bg-gray-800'
                      : 'text-gray-300 hover:text-yellow-400'
                  }`}
                >
                  Mixes
                </button>
                <button
                  onClick={() => setActiveTab('buzz')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'buzz'
                      ? 'text-yellow-400 bg-gray-800'
                      : 'text-gray-300 hover:text-yellow-400'
                  }`}
                >
                  Buzz
                </button>
              </div>

              <button className="btn btn-primary text-sm">Upload Mix</button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400">{error}</p>
            <button onClick={fetchContent} className="mt-4 px-4 py-2 btn btn-secondary">
              Try Again
            </button>
          </div>
        ) : activeTab === 'mixes' ? (
          <div className="space-y-6">
            {mixes.map(mix => (
              <div
                key={mix.id}
                className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => (window.location.href = `/mix/${mix.id}`)}
              >
                <div className="flex">
                  {/* Artwork */}
                  <div className="w-48 h-48 flex-shrink-0">
                    <CDNOptimizedImage
                      src={mix.artwork_url || undefined}
                      alt={mix.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white mb-2">{mix.title}</h3>
                        <p className="text-gray-400 mb-3">{mix.description}</p>

                        <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                          <span>🎵 {mix.genre}</span>
                          <span>🎧 {mix.plays_count.toLocaleString()} plays</span>
                          <span>❤️ {mix.likes_count} likes</span>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div
                            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center"
                            style={{
                              backgroundImage: mix.user.avatar_url
                                ? `url(${mix.user.avatar_url})`
                                : 'none',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          >
                            {!mix.user.avatar_url && (
                              <span className="text-gray-400 text-sm">👤</span>
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">{mix.user.display_name}</div>
                            <div className="text-gray-400 text-sm">@{mix.user.username}</div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-gray-400 text-sm mb-2">
                          {formatDateTime(mix.created_at)}
                        </div>
                        <button className="text-yellow-400 hover:text-yellow-300 text-sm font-medium">
                          Play Mix →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {buzzPosts.map(post => (
              <div
                key={post.id}
                className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundImage: post.user.avatar_url
                        ? `url(${post.user.avatar_url})`
                        : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!post.user.avatar_url && <span className="text-gray-400">👤</span>}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-white font-medium">{post.user.display_name}</span>
                      <span className="text-gray-400 text-sm">@{post.user.username}</span>
                      <span className="text-gray-400 text-sm">•</span>
                      <span className="text-gray-400 text-sm">
                        {formatDateTime(post.created_at)}
                      </span>
                    </div>

                    <p className="text-gray-300 mb-4 leading-relaxed">{post.content}</p>

                    {/* Actions */}
                    <div className="flex items-center space-x-6 text-sm">
                      <button className="flex items-center space-x-1 text-gray-400 hover:text-red-400 transition-colors">
                        <span>❤️</span>
                        <span>{post.likes_count}</span>
                      </button>
                      <button className="flex items-center space-x-1 text-gray-400 hover:text-blue-400 transition-colors">
                        <span>💬</span>
                        <span>{post.comments_count}</span>
                      </button>
                      <button className="flex items-center space-x-1 text-gray-400 hover:text-green-400 transition-colors">
                        <span>🔄</span>
                        <span>{post.shares_count}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
