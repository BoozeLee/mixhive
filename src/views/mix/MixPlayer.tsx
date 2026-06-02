'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { usePlayer } from '@/lib/player-store';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CDNOptimizedImage } from '@/components/CDNOptimizedImage';

interface MixData {
  id: string;
  title: string;
  description: string;
  artwork_url?: string;
  audio_url: string;
  duration: number;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

export function MixPlayer() {
  const { id } = useParams<{ id: string }>();
  const { state, seek, setVolume, toggleMute, togglePlay, next, previous } = usePlayer();
  const [mix, setMix] = useState<MixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMix();
  }, [id]);

  const fetchMix = async () => {
    try {
      // TODO: Replace with actual API call
      const mockMix: MixData = {
        id: id || '1',
        title: 'Underground Techno Mix',
        description: 'A deep journey through the underground techno scene.',
        artwork_url: undefined,
        audio_url: 'https://example.com/audio/sample.mp3',
        duration: 3456, // in seconds
        user: {
          id: '1',
          username: 'dj_example',
          display_name: 'DJ Example',
          avatar_url: undefined,
        },
      };

      setMix(mockMix);

      // Auto-play the mix if available
      if (mockMix) {
        const track = {
          id: mockMix.id,
          title: mockMix.title,
          artist: mockMix.user.display_name,
          url: mockMix.audio_url,
          artwork: mockMix.artwork_url,
          duration: mockMix.duration,
        };

        // This would be handled by the playTrack function in the player store
        setTimeout(() => {
          if (state.currentTrack?.id !== mockMix.id) {
            // This is a simulation - in reality, this would call playTrack from the context
            console.log('Would play track:', track);
          }
        }, 1000);
      }
    } catch (err) {
      setError('Failed to load mix');
      console.error('Mix fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seek(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !mix) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-2xl text-red-400 mb-2">Error</h1>
          <p className="text-gray-400">{error || 'Mix not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Mix Artwork */}
          <div className="relative">
            <div className="w-80 h-80 mx-auto rounded-2xl overflow-hidden shadow-2xl">
              <CDNOptimizedImage
                src={mix.artwork_url || undefined}
                alt={mix.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Play/Pause Overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-2xl hover:bg-opacity-60 transition-all"
            >
              <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-4xl text-black">{state.isPlaying ? '⏸' : '▶'}</span>
              </div>
            </button>
          </div>

          {/* Mix Info */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white">{mix.title}</h1>
            <p className="text-xl text-gray-400">by {mix.user.display_name}</p>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-gray-700 rounded-full h-2 relative">
                <input
                  type="range"
                  min="0"
                  max={mix.duration || 100}
                  value={state.currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
                />
                <div
                  className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(state.currentTime / (mix.duration || 100)) * 100}%` }}
                ></div>
              </div>

              <div className="flex justify-between text-sm text-gray-400">
                <span>{formatTime(state.currentTime)}</span>
                <span>{formatTime(mix.duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center space-x-6">
              <button
                onClick={previous}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="text-2xl">⏮</span>
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 bg-yellow-400 text-black rounded-full flex items-center justify-center hover:bg-yellow-300 transition-colors"
              >
                <span className="text-2xl">{state.isPlaying ? '⏸' : '▶'}</span>
              </button>

              <button onClick={next} className="text-gray-400 hover:text-white transition-colors">
                <span className="text-2xl">⏭</span>
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={toggleMute}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="text-xl">{state.isMuted ? '🔇' : '🔊'}</span>
              </button>

              <div className="w-24 bg-gray-700 rounded-full h-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={state.volume}
                  onChange={handleVolumeChange}
                  className="w-full h-2 opacity-0 cursor-pointer"
                />
                <div
                  className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${state.volume * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
              <span>🎵 {formatTime(mix.duration)}</span>
              <span>👤 @{mix.user.username}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Player Bar */}
      <div className="bg-black border-t border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center space-x-4">
          {/* Mix Thumbnail */}
          <div className="w-12 h-12 rounded-lg overflow-hidden">
            <CDNOptimizedImage
              src={mix.artwork_url || undefined}
              alt={mix.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Mix Info */}
          <div className="flex-1">
            <div className="text-white font-medium">{mix.title}</div>
            <div className="text-gray-400 text-sm">{mix.user.display_name}</div>
          </div>

          {/* Mini Controls */}
          <div className="flex items-center space-x-4">
            <button onClick={previous} className="text-gray-400 hover:text-white">
              ⏮
            </button>
            <button onClick={togglePlay} className="text-white">
              {state.isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={next} className="text-gray-400 hover:text-white">
              ⏭
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center space-x-2 w-24">
            <span className="text-gray-400 text-sm">{state.isMuted ? '🔇' : '🔊'}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={state.volume}
              onChange={handleVolumeChange}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
