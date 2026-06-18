/**
import { useTranslations } from 'next-intl';
 * CDN-Optimized Audio Component
 *
 * React component that uses CDN-optimized audio files
 * with lazy loading, preload support, and error handling.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from './ui/Icon';
import { getOptimizedAudioUrl, preloadAudio } from '../lib/cdnUrlTransformers';
import type { AudioOptimizationParams } from '../lib/cdnUrlTransformers';

interface CDNAudioProps {
  src: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  preload?: 'none' | 'metadata' | 'auto';
  optimization?: AudioOptimizationParams;
  fallback?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  lazy?: boolean;
  showLoadingIndicator?: boolean;
}

interface CDNAudioPlayerProps extends CDNAudioProps {
  title?: string;
  artist?: string;
  artwork?: string;
  showArtwork?: boolean;
  className?: string;
}

// CDN-optimized audio component
export const CDNAudio: React.FC<CDNAudioProps> = ({
  src,
  controls = true,
  autoPlay = false,
  loop = false,
  muted = false,
  className,
  preload = 'metadata',
  optimization,
  fallback,
  onPlay,
  onPause,
  onEnded,
  onError,
  onTimeUpdate,
  onLoadedMetadata,
  lazy = true,
  showLoadingIndicator = true,
}) => {
  const [cdnUrl, setCdnUrl] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(true);
  const [isOptimized, setIsOptimized] = useState(false);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Get CDN-optimized URL
  useEffect(() => {
    const fetchOptimizedUrl = async () => {
      try {
        const bucket = determineBucketFromUrl(src);
        const result = await getOptimizedAudioUrl(src, bucket, optimization);

        setCdnUrl(result.url);
        setIsOptimized(result.source === 'cdn');
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to get optimized audio URL, using original:', err);
        setCdnUrl(src);
        setIsOptimized(false);
        setIsLoading(false);
      }
    };

    if (src) {
      fetchOptimizedUrl();
    }
  }, [src, optimization]);

  // Preload audio if not lazy
  useEffect(() => {
    if (!lazy && cdnUrl && typeof window !== 'undefined') {
      preloadAudio(cdnUrl).catch(console.error);
    }
  }, [cdnUrl, lazy]);

  // Handle audio events
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlay?.();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPause?.();
  }, [onPause]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onEnded?.();
  }, [onEnded]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      setError(true);
      setIsLoading(false);
      setIsPlaying(false);
      onError?.(e);

      // Try fallback if available
      if (fallback) {
        setCdnUrl(fallback);
      }
    },
    [onError, fallback]
  );

  return (
    <div className={`relative ${className}`}>
      {/* CDN optimization indicator */}
      {isOptimized && (
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
          {t('cdn')}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && showLoadingIndicator && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          <span className="ml-2 text-sm">{t('loadingAudio')}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-600 text-sm">{t('failedToLoadAudio')}</p>
        </div>
      )}

      {/* Audio element */}
      {!error && (
        <audio
          ref={audioRef}
          src={cdnUrl}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          preload={preload}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={handleError}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          className="w-full"
        />
      )}
    </div>
  );
};

// Enhanced audio player with artwork and metadata
export const CDNAudioPlayer: React.FC<CDNAudioPlayerProps> = ({
  src,
  title = 'Unknown Track',
  artist = 'Unknown Artist',
  artwork,
  showArtwork = true,
  className,
  ...audioProps
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    setCurrentTime(audio.currentTime);
    audioProps.onTimeUpdate?.(e);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    setDuration(audio.duration);
    audioProps.onLoadedMetadata?.(e);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Artwork */}
      {showArtwork && artwork && (
        <div className="relative h-48 bg-gradient-to-br from-green-400 to-blue-500">
          <CDNArtwork
            src={artwork}
            alt={`${title} artwork`}
            size="medium"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Audio controls and metadata */}
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{title}</h3>
          <p className="text-sm text-gray-600 truncate">{artist}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-green-500 h-1 rounded-full transition-all duration-300"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Volume control */}
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-sm text-gray-600">🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Audio element */}
        <CDNAudio
          src={src}
          controls={false}
          className="w-full"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          {...audioProps}
        />
      </div>
    </div>
  );
};

// Lazy audio component that loads on interaction
export const CDNLazyAudio: React.FC<CDNAudioProps> = props => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleClick = () => {
    setIsLoaded(true);
  };

  if (!isVisible) {
    return (
      <div
        ref={containerRef}
        className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer ${props.className}`}
        onClick={handleClick}
      >
        <div className="mb-2" style={{ display: 'inline-flex' }}>
          <Icon name="music" size={22} />
        </div>
        <p className="text-sm text-gray-600">{t('clickToLoadAudio')}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        ref={containerRef}
        className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer ${props.className}`}
        onClick={handleClick}
      >
        <div className="mb-2" style={{ display: 'inline-flex' }}>
          <Icon name="music" size={22} />
        </div>
        <p className="text-sm text-gray-600">{t('clickToPlayAudio')}</p>
      </div>
    );
  }

  return <CDNAudio {...props} />;
};

// Audio playlist component
export const CDNPlaylist: React.FC<{
  tracks: Array<{
    src: string;
    title: string;
    artist: string;
    artwork?: string;
  }>;
  className?: string;
}> = ({ tracks, className }) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const handleTrackClick = (index: number) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Current track */}
      {tracks[currentTrackIndex] && (
        <CDNAudioPlayer
          src={tracks[currentTrackIndex].src}
          title={tracks[currentTrackIndex].title}
          artist={tracks[currentTrackIndex].artist}
          artwork={tracks[currentTrackIndex].artwork}
          autoPlay={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
        />
      )}

      {/* Track list */}
      <div className="border-t">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('playlist')}</h3>
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 p-2 rounded cursor-pointer transition-colors ${
                  index === currentTrackIndex
                    ? 'bg-green-50 border border-green-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleTrackClick(index)}
              >
                <div className="w-10 h-10 bg-gray-200 rounded">
                  {track.artwork ? (
                    <CDNArtwork
                      src={track.artwork}
                      alt={track.title}
                      size="thumbnail"
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-400">
                      <Icon name="music" size={28} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      index === currentTrackIndex ? 'text-green-600' : 'text-gray-900'
                    }`}
                  >
                    {track.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                </div>
                {index === currentTrackIndex && isPlaying && (
                  <div className="text-green-500">▶</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Utility functions
const determineBucketFromUrl = (url: string): string => {
  if (url.includes('mix-audio')) return 'mix-audio';
  if (url.includes('buzz-media')) return 'buzz-media';
  return 'mix-audio'; // Default fallback
};

// Export all components
export const CDN_AUDIO_COMPONENTS = {
  CDNAudio,
  CDNAudioPlayer,
  CDNLazyAudio,
  CDNPlaylist,
} as const;
