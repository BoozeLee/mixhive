'use client';

import { useState, useEffect, useRef } from 'react';
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

export function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'mixes' | 'djs'>('all');
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [djs, setDJs] = useState<DJ[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on load
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setMixes([]);
      setDJs([]);
    }
  }, [searchQuery, activeTab]);

  const performSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay

      if (activeTab === 'all' || activeTab === 'mixes') {
        const mockMixes: Mix[] = [
          {
            id: '1',
            title: `${searchQuery} Techno Mix`,
            description: 'Dark driving beats and atmospheric pads',
            genre: 'Techno',
            artwork_url: undefined,
            plays_count: 3420,
            likes_count: 245,
            created_at: '2024-01-15T00:00:00Z',
            user: {
              id: '1',
              username: 'techno_dj',
              display_name: 'Techno DJ',
              avatar_url: undefined,
            },
          },
          {
            id: '2',
            title: `${searchQuery} House Session`,
            description: 'Smooth grooves and soulful vibes',
            genre: 'House',
            artwork_url: undefined,
            plays_count: 2150,
            likes_count: 189,
            created_at: '2024-01-14T00:00:00Z',
            user: {
              id: '2',
              username: 'house_producer',
              display_name: 'House Producer',
              avatar_url: undefined,
            },
          },
        ];
        setMixes(mockMixes);
      }

      if (activeTab === 'all' || activeTab === 'djs') {
        const mockDJs: DJ[] = [
          {
            id: '1',
            username: `${searchQuery}_master`,
            display_name: `${searchQuery} Master`,
            bio: `Professional ${searchQuery} DJ and producer`,
            genres: [searchQuery],
            avatar_url: undefined,
            banner_url: undefined,
            followers_count: 5420,
            mixes_count: 24,
          },
          {
            id: '2',
            username: `${searchQuery}_artist`,
            display_name: `${searchQuery} Artist`,
            bio: `Creating amazing ${searchQuery} music`,
            genres: [searchQuery, 'Electronic'],
            avatar_url: undefined,
            banner_url: undefined,
            followers_count: 3210,
            mixes_count: 18,
          },
        ];
        setDJs(mockDJs);
      }
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setMixes([]);
    setDJs([]);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <form onSubmit={handleSearch} className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search mixes, DJs, genres..."
                className="w-full px-4 py-3 pl-12 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                🔍
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </form>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 pb-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'text-yellow-400 bg-gray-800'
                  : 'text-gray-300 hover:text-yellow-400'
              }`}
            >
              All
            </button>
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
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {searchQuery.trim() ? (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-400">{error}</p>
                <button onClick={performSearch} className="mt-4 px-4 py-2 btn btn-secondary">
                  Try Again
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">
                  Search results for "{searchQuery}"
                </h2>

                {(activeTab === 'all' || activeTab === 'mixes') && mixes.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Mixes</h3>
                    <div className="space-y-4">
                      {mixes.map(mix => (
                        <div
                          key={mix.id}
                          className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors cursor-pointer"
                          onClick={() => (window.location.href = `/mix/${mix.id}`)}
                        >
                          <div className="flex">
                            {/* Artwork */}
                            <div className="w-20 h-20 flex-shrink-0">
                              <CDNOptimizedImage
                                src={mix.artwork_url || undefined}
                                alt={mix.title}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-4">
                              <h4 className="text-white font-medium mb-1">{mix.title}</h4>
                              <p className="text-gray-400 text-sm mb-2 line-clamp-1">
                                {mix.description}
                              </p>

                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <span>🎵 {mix.genre}</span>
                                <span>🎧 {mix.plays_count.toLocaleString()}</span>
                                <span>❤️ {mix.likes_count}</span>
                              </div>

                              <div className="flex items-center space-x-2 mt-2">
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
                                  {!mix.user.avatar_url && (
                                    <span className="text-gray-400 text-xs">👤</span>
                                  )}
                                </div>
                                <span className="text-gray-400 text-sm">
                                  {mix.user.display_name}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(activeTab === 'all' || activeTab === 'djs') && djs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">DJs</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {djs.map(dj => (
                        <div
                          key={dj.id}
                          className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors cursor-pointer"
                          onClick={() => (window.location.href = `/u/${dj.username}`)}
                        >
                          <div className="flex items-center space-x-3">
                            {/* Avatar */}
                            <div
                              className="w-12 h-12 rounded-full bg-gray-800"
                              style={{
                                backgroundImage: dj.avatar_url ? `url(${dj.avatar_url})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }}
                            >
                              {!dj.avatar_url && <span className="text-gray-400">👤</span>}
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                              <h4 className="text-white font-medium">{dj.display_name}</h4>
                              <p className="text-gray-400 text-sm mb-1">@{dj.username}</p>
                              <p className="text-gray-400 text-xs line-clamp-2 mb-2">{dj.bio}</p>

                              <div className="flex items-center space-x-4 text-xs text-gray-400">
                                <span>🎵 {dj.mixes_count} mixes</span>
                                <span>👥 {dj.followers_count.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mixes.length === 0 && djs.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-semibold text-white mb-2">No results found</h3>
                    <p className="text-gray-400 mb-4">
                      Try searching with different keywords or browse our discovery section
                    </p>
                    <button onClick={() => setActiveTab('all')} className="btn btn-primary">
                      Browse All Content
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-2xl font-bold text-white mb-4">Search MixHive</h2>
            <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
              Search for mixes, DJs, genres, and more. Find your next favorite track or discover new
              artists in the underground music scene.
            </p>

            {/* Popular Searches */}
            <div className="max-w-4xl mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Popular Searches</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {['techno', 'house', 'drum and bass', 'minimal', 'ambient', 'experimental'].map(
                  term => (
                    <button
                      key={term}
                      onClick={() => setSearchQuery(term)}
                      className="px-4 py-2 bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 transition-colors"
                    >
                      #{term}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
