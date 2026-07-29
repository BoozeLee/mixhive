/**
 * CDN-Optimized Image Component
 *
 * React component that automatically uses CDN-optimized images
 * with lazy loading, responsive loading, and fallback support.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  getOptimizedImageUrl,
  getOptimizedAvatarUrl,
  getOptimizedBannerUrl,
  getOptimizedArtworkUrl,
  lazyLoader,
  preloadImage,
} from '../lib/cdnUrlTransformers';
import type { ImageOptimizationParams } from '../lib/cdnUrlTransformers';

interface CDNImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
  lazy?: boolean;
  optimization?: ImageOptimizationParams;
  fallback?: string;
  sizesConfig?: Array<{
    size: 'thumbnail' | 'small' | 'medium' | 'large';
    width: number;
    height: number;
  }>;
}

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  defaultSize?: 'thumbnail' | 'small' | 'medium' | 'large';
  responsive?: boolean;
  priority?: boolean;
  optimization?: ImageOptimizationParams;
  fallback?: string;
}

// CDN-optimized image component
export const CDNImage: React.FC<CDNImageProps> = ({
  src,
  alt,
  className,
  width,
  height,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  sizes,
  quality = 85,
  onLoad,
  onError,
  lazy = true,
  optimization,
  fallback,
}) => {
  const [cdnUrl, setCdnUrl] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const optimizedParams: ImageOptimizationParams = useMemo(
    () => ({
      format: 'webp',
      quality,
      ...optimization,
    }),
    [quality, optimization]
  );

  // Get CDN-optimized URL
  useEffect(() => {
    const fetchOptimizedUrl = async () => {
      try {
        const bucket = determineBucketFromUrl(src);
        const result = await getOptimizedImageUrl(src, bucket, optimizedParams);

        setCdnUrl(result.url);
        setIsOptimized(result.source === 'cdn');
        setIsLoading(false);
      } catch (err) {
        console.warn('Failed to get optimized URL, using original:', err);
        setCdnUrl(src);
        setIsOptimized(false);
        setIsLoading(false);
      }
    };

    if (src) {
      fetchOptimizedUrl();
    }
  }, [src, optimizedParams]);

  // Handle image loading
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback(() => {
    setError(true);
    setIsLoading(false);
    onError?.();

    // Try fallback if available
    if (fallback) {
      setCdnUrl(fallback);
    }
  }, [onError, fallback]);

  // Lazy loading support
  useEffect(() => {
    if (lazy && imgRef.current && typeof window !== 'undefined') {
      lazyLoader.loadImageElement(imgRef.current, {
        placeholder: '/placeholder-image.jpg',
        errorFallback: fallback || '/placeholder-image.jpg',
        onLoad: handleLoad,
        onError: handleError,
      });
    }
  }, [lazy, fallback, handleLoad, handleError]);

  // Preload image if priority
  useEffect(() => {
    if (priority && cdnUrl && typeof window !== 'undefined') {
      preloadImage(cdnUrl).catch(console.error);
    }
  }, [cdnUrl, priority]);

  if (error) {
    return (
      <div className={`bg-gray-200 ${className}`} style={{ width, height }}>
        <div className="flex items-center justify-center w-full h-full text-gray-400">
          <span>Image not available</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-gray-200 animate-pulse ${className}`} style={{ width, height }}>
        <div className="flex items-center justify-center w-full h-full text-gray-400">
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* CDN optimization indicator (for debugging) */}
      {isOptimized && (
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
          CDN
        </div>
      )}

      <Image
        ref={imgRef}
        src={cdnUrl}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        sizes={sizes}
        quality={quality}
        onLoad={handleLoad}
        onError={handleError}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

// Responsive CDN image component
export const CDNResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  className,
  defaultSize = 'medium',
  responsive = true,
  priority = false,
  optimization,
  fallback,
}) => {
  const [currentSize, setCurrentSize] = useState(defaultSize);
  const [cdnUrl, setCdnUrl] = useState<string>(src);

  // Handle window resize for responsive images
  useEffect(() => {
    if (!responsive) return;

    const handleResize = () => {
      const width = window.innerWidth;
      let newSize: typeof defaultSize;

      if (width >= 1024) newSize = 'large';
      else if (width >= 768) newSize = 'medium';
      else if (width >= 448) newSize = 'small';
      else newSize = 'thumbnail';

      setCurrentSize(newSize);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [responsive]);

  // Get CDN-optimized URL for current size
  useEffect(() => {
    const fetchResponsiveUrl = async () => {
      try {
        let result;

        switch (defaultSize) {
          case 'avatar':
            result = await getOptimizedAvatarUrl(src, currentSize, optimization);
            break;
          case 'banner':
            result = await getOptimizedBannerUrl(src, currentSize, optimization);
            break;
          case 'artwork':
            result = await getOptimizedArtworkUrl(src, currentSize, optimization);
            break;
          default: {
            const bucket = determineBucketFromUrl(src);
            const sizeOpt = {
              ...optimization,
              width: getSizeWidth(currentSize),
              height: getSizeHeight(currentSize),
            };
            result = await getOptimizedImageUrl(src, bucket, sizeOpt);
          }
        }

        setCdnUrl(result.url);
      } catch (err) {
        console.warn('Failed to get responsive URL, using original:', err);
        setCdnUrl(src);
      }
    };

    if (src) {
      fetchResponsiveUrl();
    }
  }, [src, currentSize, optimization, defaultSize]);

  return (
    <CDNImage
      src={cdnUrl}
      alt={alt}
      className={className}
      priority={priority}
      optimization={optimization}
      fallback={fallback}
    />
  );
};

// CDN avatar component
export const CDNAvatar: React.FC<{
  src: string;
  alt: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  priority?: boolean;
  fallback?: string;
}> = ({ src, alt, size = 'medium', className, priority, fallback }) => {
  return (
    <CDNImage
      src={src}
      alt={alt}
      className={className}
      width={getSizeWidth(size)}
      height={getSizeWidth(size)}
      priority={priority}
      optimization={{
        format: 'webp',
        quality: 80,
        fit: 'cover',
      }}
      fallback={fallback}
    />
  );
};

// CDN banner component
export const CDNBanner: React.FC<{
  src: string;
  alt: string;
  size?: 'small' | 'medium' | 'large' | 'featured';
  className?: string;
  priority?: boolean;
  fallback?: string;
}> = ({ src, alt, size = 'medium', className, priority, fallback }) => {
  return (
    <CDNImage
      src={src}
      alt={alt}
      className={className}
      width={getSizeWidth(size)}
      height={getSizeHeight(size)}
      priority={priority}
      optimization={{
        format: 'webp',
        quality: 90,
        fit: 'cover',
      }}
      fallback={fallback}
    />
  );
};

// CDN artwork component
export const CDNArtwork: React.FC<{
  src: string;
  alt: string;
  size?: 'thumbnail' | 'small' | 'medium' | 'large' | 'original';
  className?: string;
  priority?: boolean;
  fallback?: string;
}> = ({ src, alt, size = 'medium', className, priority, fallback }) => {
  return (
    <CDNImage
      src={src}
      alt={alt}
      className={className}
      width={getSizeWidth(size)}
      height={getSizeHeight(size)}
      priority={priority}
      optimization={{
        format: 'webp',
        quality: 85,
        fit: 'cover',
      }}
      fallback={fallback}
    />
  );
};

// Lazy CDN image component with intersection observer
export const CDNLazyImage: React.FC<CDNImageProps> = props => {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  if (!isVisible) {
    return (
      <div
        ref={imgRef}
        className={`bg-gray-200 animate-pulse ${props.className}`}
        style={{ width: props.width, height: props.height }}
      >
        <div className="flex items-center justify-center w-full h-full text-gray-400">
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return <CDNImage {...props} ref={imgRef} />;
};

// Utility functions
const determineBucketFromUrl = (url: string): string => {
  if (url.includes('profile-avatars')) return 'profile-avatars';
  if (url.includes('profile-banners')) return 'profile-banners';
  if (url.includes('mix-artwork')) return 'mix-artwork';
  if (url.includes('mix-audio')) return 'mix-audio';
  if (url.includes('mix-waveforms')) return 'mix-waveforms';
  if (url.includes('buzz-media')) return 'buzz-media';
  return 'mix-artwork'; // Default fallback
};

const getSizeWidth = (size: string): number => {
  const sizes: Record<string, number> = {
    thumbnail: 80,
    small: 200,
    medium: 400,
    large: 800,
    original: 1200,
    featured: 1600,
  };
  return sizes[size] || 400;
};

const getSizeHeight = (size: string): number => {
  const sizes: Record<string, number> = {
    thumbnail: 80,
    small: 200,
    medium: 400,
    large: 800,
    original: 1200,
    featured: 900, // Different aspect ratio for featured
  };
  return sizes[size] || 400;
};

// Export all components
export const CDN_IMAGE_COMPONENTS = {
  CDNImage,
  CDNResponsiveImage,
  CDNAvatar,
  CDNBanner,
  CDNArtwork,
  CDNLazyImage,
} as const;

export const CDNOptimizedImage = CDNImage;
