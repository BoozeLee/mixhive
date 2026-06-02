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

interface DJ {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  genres: string[];
  avatar_url?: string;
  banner_url?: string;
  followers_count: number;
  mixes_count: number;
}

export function Discover() {
  const [activeTab, setActiveTab] = useState<'mixes' | 'djs' | 'genres'>('mixes');
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [djs, setDJs] = useState<DJ[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const genres = [
    'Techno',
    'House',
    'Trance',
    'Drum & Bass',
    'Dubstep',
    'Ambient',
    'Electro',
    'Minimal',
    'Progressive',
    'Psytrance',
    'Hardstyle',
    'Future Bass',
    'Trap',
    'Hip Hop',
    'Experimental',
  ];

  useEffect(() => {
    fetchContent();
  }, [activeTab, selectedGenre]);

  const fetchContent = async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'mixes') {
        // TODO: Replace with actual API call
        const mockMixes: Mix[] = [
          {
            id: '1',
            title: 'Underground Techno Journey',
            description: 'Dark driving beats and atmospheric pads',
            genre: 'Techno',
            artwork_url: undefined,
            plays_count: 5420,
            likes_count: 345,
            created_at: '2024-01-15T00:00:00Z',
            user: {
              id: '1',
              username: 'underground_dj',
              display_name: 'Underground DJ',
              avatar_url: undefined,
            },
          },
          {
            id: '2',
            title: 'Deep House Vibes',
            description: 'Smooth grooves and soulful melodies',
            genre: 'House',
            artwork_url: undefined,
            plays_count: 3210,
            likes_count: 267,
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
            title: 'Minimal Beats Collection',
            description: 'Clean and precise electronic rhythms',
            genre: 'Minimal',
            artwork_url: undefined,
            plays_count: 2150,
            likes_count: 189,
            created_at: '2024-01-13T00:00:00Z',
            user: {
              id: '3',
              username: 'minimal_beats',
              display_name: 'Minimal Beats',
              avatar_url: undefined,
            },
          },
        ];

        // Filter by genre if selected
        const filteredMixes = selectedGenre
          ? mockMixes.filter(mix => mix.genre === selectedGenre)
          : mockMixes;

        setMixes(filteredMixes);
      } else if (activeTab === 'djs') {
        // TODO: Replace with actual API call
        const mockDJs: DJ[] = [
          {
            id: '1',
            username: 'techno_king',
            display_name: 'Techno King',
            bio: 'Spinning the darkest techno beats in the underground scene',
            genres: ['Techno', 'Industrial', 'Dark'],
            avatar_url: undefined,
            banner_url: undefined,
            followers_count: 5420,
            mixes_count: 24,
          },
          {
            id: '2',
            username: 'house_groover',
            display_name: 'House Groover',
            bio: 'Bringing the soul back to house music',
            genres: ['Deep House', 'Soulful', 'Disco'],
            avatar_url: undefined,
            banner_url: undefined,
            followers_count: 3210,
            mixes_count: 18,
          },
          {
            id: '3',
            username: 'minimal_master',
            display_name: 'Minimal Master',
            bio: 'Precision and clarity in every beat',
            genres: ['Minimal', 'Techno', 'Electro'],
            avatar_url: undefined,
            banner_url: undefined,
            followers_count: 2150,
            mixes_count: 15,
          },
        ];
        setDJs(mockDJs);
      }
    } catch (err) {
      setError('Failed to load content');
      console.error('Content fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-yellow-400">Discover</h1>
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
                  onClick={() => setActiveTab('djs')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'djs'
                      ? 'text-yellow-400 bg-gray-800'
                      : 'text-gray-300 hover:text-yellow-400'
                  }`}
                >
                  DJs
                </button>
                <button
                  onClick={() => setActiveTab('genres')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'genres'
                      ? 'text-yellow-400 bg-gray-800'
                      : 'text-gray-300 hover:text-yellow-400'
                  }`}
                >
                  Genres
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Genre Filter */}
      {activeTab === 'mixes' && (
        <div className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-4">
              <span className="text-gray-400 text-sm">Filter by genre:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedGenre('')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedGenre === ''
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                {genres.map(genre => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedGenre === genre
                        ? 'bg-yellow-400 text-black'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              {selectedGenre && (
                <button
                  onClick={() => setSelectedGenre('')}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mixes.map(mix => (
              <div
                key={mix.id}
                className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => (window.location.href = `/mix/${mix.id}`)}
              >
                <div className="aspect-square bg-gray-800">
                  <CDNOptimizedImage
                    src={mix.artwork_url || undefined}
                    alt={mix.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-2 line-clamp-1">
                    {mix.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{mix.description}</p>

                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>🎵 {mix.genre}</span>
                    <span>🎧 {mix.plays_count.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center space-x-2 mt-3">
                    <div
                      className="w-6 h-6 rounded-full bg-gray-800"
                      style={{
                        backgroundImage: mix.user.avatar_url
                          ? `url(${mix.user.avatar_url})`
                          : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      {!mix.user.avatar_url && <span className="text-gray-400 text-xs">👤</span>}
                    </div>
                    <span className="text-white text-sm">{mix.user.display_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'djs' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {djs.map(dj => (
              <div
                key={dj.id}
                className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => (window.location.href = `/u/${dj.username}`)}
              >
                {/* Banner */}
                <div
                  className="h-32 bg-cover bg-center"
                  style={{
                    backgroundImage: dj.banner_url
                      ? `url(${dj.banner_url})`
                      : 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
                  }}
                ></div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div
                      className="w-16 h-16 rounded-full bg-gray-800"
                      style={{
                        backgroundImage: dj.avatar_url ? `url(${dj.avatar_url})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      {!dj.avatar_url && <span className="text-gray-400 text-xl">👤</span>}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{dj.display_name}</h3>
                      <p className="text-gray-400 text-sm">@{dj.username}</p>
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-3 line-clamp-2">{dj.bio}</p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {dj.genres.map(genre => (
                      <span
                        key={genre}
                        className="px-2 py-1 bg-yellow-400 text-black rounded-full text-xs font-medium"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>🎵 {dj.mixes_count} mixes</span>
                    <span>👥 {dj.followers_count.toLocaleString()} followers</span>
                  </div>

                  <button className="w-full mt-3 btn btn-primary text-sm">Follow</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {genres.map(genre => (
              <button
                key={genre}
                className="bg-gray-900 hover:bg-gray-800 rounded-lg p-4 transition-colors text-center"
                onClick={() => {
                  setActiveTab('mixes');
                  setSelectedGenre(genre);
                }}
              >
                <div className="text-3xl mb-2">🎵</div>
                <h3 className="text-white font-medium">{genre}</h3>
                <p className="text-gray-400 text-sm mt-1">Explore</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
