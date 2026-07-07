/**
 * Specialized CDN URL Transformation Utilities
 *
 * Provides media-specific URL transformations with optimization
 * for different types of content in MixHive.
 */

import { getOptimizedMediaUrl, MediaBucket } from './cdn';
import type { CDNOptimizationParams } from './cdn';

export interface AudioOptimizationParams extends CDNOptimizationParams {
  bitrate?: number;
  sampleRate?: number;
  codec?: 'mp3' | 'aac' | 'ogg' | 'flac';
  duration?: number;
}

export interface ImageOptimizationParams extends CDNOptimizationParams {
  fit?: 'cover' | 'contain' | 'fill' | 'scale-down';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  background?: string;
  borderRadius?: number;
  blur?: number;
  sharpen?: number;
}

export interface VideoOptimizationParams extends CDNOptimizationParams {
  codec?: 'h264' | 'hevc' | 'vp8' | 'vp9';
  fps?: number;
  bitrate?: number;
  duration?: number;
  watermark?: string;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WaveformOptimizationParams extends CDNOptimizationParams {
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  detail?: 'low' | 'medium' | 'high';
}

// Audio-specific URL transformation
export const getOptimizedAudioUrl = async (
  supabaseUrl: string,
  bucket: MediaBucket,
  optimization?: AudioOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  // Validate bucket is audio-related
  if (!['mix-audio', 'buzz-media'].includes(bucket)) {
    throw new Error(`Invalid bucket for audio optimization: ${bucket}`);
  }

  // Default audio optimization parameters
  const audioDefaults: AudioOptimizationParams = {
    format: 'mp3',
    quality: 128,
    codec: 'mp3',
    bitrate: 128,
  };

  const mergedOptimization = { ...audioDefaults, ...optimization };

  return getOptimizedMediaUrl(supabaseUrl, bucket, mergedOptimization);
};

// Image-specific URL transformation
export const getOptimizedImageUrl = async (
  supabaseUrl: string,
  bucket: MediaBucket,
  optimization?: ImageOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  // Validate bucket is image-related
  if (!['mix-artwork', 'profile-avatars', 'profile-banners', 'buzz-media'].includes(bucket)) {
    throw new Error(`Invalid bucket for image optimization: ${bucket}`);
  }

  // Default image optimization parameters based on bucket type
  const imageDefaults: Record<MediaBucket, ImageOptimizationParams> = {
    'mix-artwork': {
      format: 'webp',
      quality: 85,
      fit: 'cover',
    },
    'profile-avatars': {
      format: 'webp',
      quality: 80,
      fit: 'cover',
      width: 200,
      height: 200,
    },
    'profile-banners': {
      format: 'webp',
      quality: 90,
      fit: 'cover',
      width: 1200,
      height: 400,
    },
    'buzz-media': {
      format: 'webp',
      quality: 75,
      fit: 'contain',
    },
    'mix-audio': { format: 'webp', quality: 80 },
    'mix-waveforms': { format: 'webp', quality: 90 },
  };

  const mergedOptimization = { ...imageDefaults[bucket], ...optimization };

  return getOptimizedMediaUrl(supabaseUrl, bucket, mergedOptimization);
};

// Video-specific URL transformation
export const getOptimizedVideoUrl = async (
  supabaseUrl: string,
  bucket: MediaBucket,
  optimization?: VideoOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  // Validate bucket is video-related
  if (!['buzz-media'].includes(bucket)) {
    throw new Error(`Invalid bucket for video optimization: ${bucket}`);
  }

  // Default video optimization parameters
  const videoDefaults: VideoOptimizationParams = {
    format: 'webm',
    quality: 80,
    codec: 'vp9',
    bitrate: 2000,
  };

  const mergedOptimization = { ...videoDefaults, ...optimization };

  return getOptimizedMediaUrl(supabaseUrl, bucket, mergedOptimization);
};

// Waveform-specific URL transformation
export const getOptimizedWaveformUrl = async (
  supabaseUrl: string,
  bucket: MediaBucket,
  optimization?: WaveformOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  // Validate bucket is waveform-related
  if (bucket !== 'mix-waveforms') {
    throw new Error(`Invalid bucket for waveform optimization: ${bucket}`);
  }

  // Default waveform optimization parameters
  const waveformDefaults: WaveformOptimizationParams = {
    format: 'png',
    quality: 90,
    width: 1200,
    height: 200,
    detail: 'medium',
    color: '#10b981',
    backgroundColor: 'transparent',
  };

  const mergedOptimization = { ...waveformDefaults, ...optimization };

  return getOptimizedMediaUrl(supabaseUrl, bucket, mergedOptimization);
};

// Avatar optimization with preset sizes
export const getOptimizedAvatarUrl = async (
  supabaseUrl: string,
  size: 'small' | 'medium' | 'large' = 'medium',
  optimization?: ImageOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  const sizeDefaults: Record<string, { width: number; height: number; quality: number }> = {
    small: { width: 40, height: 40, quality: 70 },
    medium: { width: 100, height: 100, quality: 80 },
    large: { width: 200, height: 200, quality: 85 },
  };

  const sizeConfig = sizeDefaults[size];
  const avatarOptimization: ImageOptimizationParams = {
    ...sizeConfig,
    format: 'webp',
    fit: 'cover',
    ...optimization,
  };

  return getOptimizedImageUrl(supabaseUrl, 'profile-avatars', avatarOptimization);
};

// Banner optimization with preset sizes
export const getOptimizedBannerUrl = async (
  supabaseUrl: string,
  size: 'small' | 'medium' | 'large' | 'featured' = 'medium',
  optimization?: ImageOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  const sizeDefaults: Record<string, { width: number; height: number; quality: number }> = {
    small: { width: 400, height: 200, quality: 70 },
    medium: { width: 800, height: 400, quality: 80 },
    large: { width: 1200, height: 600, quality: 85 },
    featured: { width: 1600, height: 800, quality: 90 },
  };

  const sizeConfig = sizeDefaults[size];
  const bannerOptimization: ImageOptimizationParams = {
    ...sizeConfig,
    format: 'webp',
    fit: 'cover',
    ...optimization,
  };

  return getOptimizedImageUrl(supabaseUrl, 'profile-banners', bannerOptimization);
};

// Artwork optimization with preset configurations
export const getOptimizedArtworkUrl = async (
  supabaseUrl: string,
  size: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'medium',
  optimization?: ImageOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  const sizeDefaults: Record<string, { width: number; height: number; quality: number }> = {
    thumbnail: { width: 80, height: 80, quality: 70 },
    small: { width: 200, height: 200, quality: 75 },
    medium: { width: 400, height: 400, quality: 80 },
    large: { width: 800, height: 800, quality: 85 },
    original: { width: 1200, height: 1200, quality: 90 },
  };

  const sizeConfig = sizeDefaults[size];
  const artworkOptimization: ImageOptimizationParams = {
    ...sizeConfig,
    format: 'webp',
    fit: 'cover',
    ...optimization,
  };

  return getOptimizedImageUrl(supabaseUrl, 'mix-artwork', artworkOptimization);
};

// Buzz media optimization with type detection
export const getOptimizedBuzzMediaUrl = async (
  supabaseUrl: string,
  mediaType: 'image' | 'audio' | 'video',
  optimization?: ImageOptimizationParams | AudioOptimizationParams | VideoOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  let optimizedUrl: { url: string; source: 'cdn' | 'supabase' };

  switch (mediaType) {
    case 'image': {
      const imageOpt: ImageOptimizationParams = {
        format: 'webp',
        quality: 75,
        fit: 'contain',
        ...optimization,
      } as ImageOptimizationParams;
      optimizedUrl = await getOptimizedImageUrl(supabaseUrl, 'buzz-media', imageOpt);
      break;
    }

    case 'audio': {
      const audioOpt: AudioOptimizationParams = {
        format: 'mp3',
        quality: 128,
        bitrate: 128,
        ...optimization,
      } as AudioOptimizationParams;
      optimizedUrl = await getOptimizedAudioUrl(supabaseUrl, 'buzz-media', audioOpt);
      break;
    }

    case 'video': {
      const videoOpt: VideoOptimizationParams = {
        format: 'webm',
        quality: 80,
        codec: 'vp9',
        bitrate: 2000,
        ...optimization,
      } as VideoOptimizationParams;
      optimizedUrl = await getOptimizedVideoUrl(supabaseUrl, 'buzz-media', videoOpt);
      break;
    }

    default:
      throw new Error(`Unsupported media type for buzz optimization: ${mediaType}`);
  }

  return optimizedUrl;
};

// Responsive image generation for multiple sizes
export const getResponsiveImageUrls = async (
  supabaseUrl: string,
  bucket: MediaBucket,
  optimization?: ImageOptimizationParams
): Promise<Array<{ size: string; url: string; source: 'cdn' | 'supabase' }>> => {
  const sizes = ['thumbnail', 'small', 'medium', 'large'];
  const responsiveUrls = [];

  for (const size of sizes) {
    let sizeOptimization: ImageOptimizationParams | undefined;

    if (size === 'thumbnail') {
      sizeOptimization = { width: 80, height: 80, quality: 70 };
    } else if (size === 'small') {
      sizeOptimization = { width: 200, height: 200, quality: 75 };
    } else if (size === 'medium') {
      sizeOptimization = { width: 400, height: 400, quality: 80 };
    } else if (size === 'large') {
      sizeOptimization = { width: 800, height: 800, quality: 85 };
    }

    const mergedOptimization = { ...sizeOptimization, ...optimization };
    const optimizedUrl = await getOptimizedImageUrl(supabaseUrl, bucket, mergedOptimization);

    responsiveUrls.push({
      size,
      url: optimizedUrl.url,
      source: optimizedUrl.source,
    });
  }

  return responsiveUrls;
};

// Lazy loading utilities with intersection observer
export interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number;
  placeholder?: string;
  errorFallback?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const createLazyLoader = () => {
  if (typeof window === 'undefined') {
    return {
      loadImage: (url: string, _options?: LazyLoadOptions) => Promise.resolve(url),
      loadImageElement: (_element: HTMLImageElement, _options?: LazyLoadOptions) =>
        Promise.resolve(true),
    };
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    },
    {
      rootMargin: '50px',
      threshold: 0.1,
    }
  );

  return {
    loadImage: (url: string, options?: LazyLoadOptions): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          options?.onLoad?.();
          resolve(url);
        };
        img.onerror = () => {
          options?.onError?.();
          reject(new Error(`Failed to load image: ${url}`));
        };
        img.src = url;
      });
    },

    loadImageElement: (element: HTMLImageElement, options?: LazyLoadOptions): Promise<boolean> => {
      return new Promise(resolve => {
        const src = element.dataset.src;
        if (!src) {
          resolve(false);
          return;
        }

        // Check if already loaded
        if (element.complete) {
          resolve(true);
          return;
        }

        element.onload = () => {
          options?.onLoad?.();
          resolve(true);
        };

        element.onerror = () => {
          options?.onError?.();
          if (options?.errorFallback) {
            element.src = options.errorFallback;
          }
          resolve(false);
        };

        // If element is in viewport, load immediately
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom >= 0;

        if (isVisible) {
          element.src = src;
          element.removeAttribute('data-src');
        } else {
          observer.observe(element);
        }
      });
    },
  };
};

export const lazyLoader = createLazyLoader();

// Preloading utilities
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
    document.head.appendChild(link);
  });
};

export const preloadAudio = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'audio';
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to preload audio: ${url}`));
    document.head.appendChild(link);
  });
};

// Export utility functions
export const CDN_URL_UTILS = {
  getOptimizedAudioUrl,
  getOptimizedImageUrl,
  getOptimizedVideoUrl,
  getOptimizedWaveformUrl,
  getOptimizedAvatarUrl,
  getOptimizedBannerUrl,
  getOptimizedArtworkUrl,
  getOptimizedBuzzMediaUrl,
  getResponsiveImageUrls,
  lazyLoader,
  preloadImage,
  preloadAudio,
} as const;
