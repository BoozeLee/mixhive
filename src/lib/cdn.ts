/**
 * CDN Integration Module for MixHive
 *
 * Provides comprehensive CDN integration with multiple providers,
 * fallback mechanisms, and optimization features for media files.
 */

export interface CDNConfig {
  provider: 'cloudflare' | 'aws-cloudfront' | 'custom' | 'supabase';
  enabled: boolean;
  baseUrl?: string;
  fallbackToSupabase: boolean;
  cacheSettings: {
    audio: CacheConfig;
    artwork: CacheConfig;
    waveform: CacheConfig;
    avatar: CacheConfig;
    banner: CacheConfig;
    buzz: CacheConfig;
  };
  optimization: {
    lazyLoading: boolean;
    qualitySelection: boolean;
    formatOptimization: boolean;
    compression: boolean;
  };
}

export interface CacheConfig {
  maxAge: number;
  immutable: boolean;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  cdnCacheKey?: string;
}

export interface CDNHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastCheck: Date;
  error?: string;
}

export interface CDNOptimizationParams {
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'mp3' | 'aac';
  width?: number;
  height?: number;
  compression?: number;
}

export type MediaBucket =
  | 'mix-audio'
  | 'mix-artwork'
  | 'mix-waveforms'
  | 'profile-avatars'
  | 'profile-banners'
  | 'buzz-media';

const DEFAULT_CDN_CONFIG: CDNConfig = {
  provider: 'supabase',
  enabled: false,
  fallbackToSupabase: true,
  cacheSettings: {
    audio: {
      maxAge: 31536000, // 1 year
      immutable: true,
      sMaxAge: 31536000,
      staleWhileRevalidate: 86400,
    },
    artwork: {
      maxAge: 31536000,
      immutable: true,
      sMaxAge: 31536000,
      staleWhileRevalidate: 86400,
    },
    waveform: {
      maxAge: 31536000,
      immutable: true,
      sMaxAge: 31536000,
      staleWhileRevalidate: 86400,
    },
    avatar: {
      maxAge: 86400, // 1 day
      immutable: false,
      sMaxAge: 3600,
      staleWhileRevalidate: 86400,
    },
    banner: {
      maxAge: 86400,
      immutable: false,
      sMaxAge: 3600,
      staleWhileRevalidate: 86400,
    },
    buzz: {
      maxAge: 86400,
      immutable: false,
      sMaxAge: 3600,
      staleWhileRevalidate: 86400,
    },
  },
  optimization: {
    lazyLoading: true,
    qualitySelection: true,
    formatOptimization: true,
    compression: true,
  },
};

// Environment-specific configurations
export const getCDNConfig = (): CDNConfig => {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'development') {
    return {
      ...DEFAULT_CDN_CONFIG,
      provider: 'supabase',
      enabled: false, // Disabled in development for easier debugging
      fallbackToSupabase: true,
    };
  }

  if (env === 'production') {
    return {
      ...DEFAULT_CDN_CONFIG,
      provider: process.env.NEXT_PUBLIC_CDN_PROVIDER || 'cloudflare',
      enabled: process.env.NEXT_PUBLIC_CDN_ENABLED === 'true',
      baseUrl: process.env.NEXT_PUBLIC_CDN_BASE_URL,
      fallbackToSupabase: process.env.NEXT_PUBLIC_CDN_FALLBACK !== 'false',
      optimization: {
        lazyLoading: process.env.NEXT_PUBLIC_CDN_LAZY_LOADING !== 'false',
        qualitySelection: process.env.NEXT_PUBLIC_CDN_QUALITY_SELECTION !== 'false',
        formatOptimization: process.env.NEXT_PUBLIC_CDN_FORMAT_OPTIMIZATION !== 'false',
        compression: process.env.NEXT_PUBLIC_CDN_COMPRESSION !== 'false',
      },
    };
  }

  // Staging environment
  return {
    ...DEFAULT_CDN_CONFIG,
    provider: process.env.NEXT_PUBLIC_CDN_PROVIDER || 'supabase',
    enabled: process.env.NEXT_PUBLIC_CDN_ENABLED !== 'false',
    baseUrl: process.env.NEXT_PUBLIC_CDN_BASE_URL,
    fallbackToSupabase: true,
    optimization: {
      lazyLoading: true,
      qualitySelection: true,
      formatOptimization: true,
      compression: true,
    },
  };
};

export const cdnConfig = getCDNConfig();

// CDN URL transformation utilities
export const transformCDNUrl = (
  supabaseUrl: string,
  bucket: MediaBucket,
  optimization?: CDNOptimizationParams
): string => {
  if (!cdnConfig.enabled || !cdnConfig.baseUrl) {
    return supabaseUrl;
  }

  try {
    const url = new URL(supabaseUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];

    // Extract file extension and optimize format if needed
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
    let optimizedFormat = optimization?.format;

    if (cdnConfig.optimization.formatOptimization) {
      if (fileExt.startsWith('jp') && optimizedFormat !== 'png') {
        optimizedFormat = 'webp'; // Convert JPG to WebP
      } else if (fileExt === 'png' && optimizedFormat !== 'png') {
        optimizedFormat = 'webp'; // Convert PNG to WebP
      }
    }

    // Build CDN URL
    let cdnPath = `/${bucket}/`;

    // Add optimization parameters
    const searchParams = new URLSearchParams();

    if (cdnConfig.optimization.qualitySelection && optimization?.quality) {
      searchParams.set('q', optimization.quality.toString());
    }

    if (cdnConfig.optimization.compression && optimization?.compression) {
      searchParams.set('cmp', optimization.compression.toString());
    }

    if (optimizedFormat && optimizedFormat !== fileExt) {
      searchParams.set('fmt', optimizedFormat);
      // Remove original extension and add optimized one
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      cdnPath += `${nameWithoutExt}.${optimizedFormat}`;
    } else {
      cdnPath += fileName;
    }

    const optimizedParams = searchParams.toString();
    const cdnUrl = `${cdnConfig.baseUrl}${cdnPath}${optimizedParams ? `?${optimizedParams}` : ''}`;

    return cdnUrl;
  } catch (error) {
    console.warn('Failed to transform CDN URL:', error);
    return supabaseUrl; // Fallback to original URL
  }
};

// Get CDN cache headers for specific media type
export const getCDNCacheHeaders = (bucket: MediaBucket): Record<string, string> => {
  const cacheConfig = cdnConfig.cacheSettings[bucket];

  const headers: Record<string, string> = {
    'Cache-Control': `public, max-age=${cacheConfig.maxAge}${cacheConfig.immutable ? ', immutable' : ''}`,
  };

  if (cacheConfig.sMaxAge) {
    headers['Cache-Control'] += `, s-maxage=${cacheConfig.sMaxAge}`;
  }

  if (cacheConfig.staleWhileRevalidate) {
    headers['Cache-Control'] += `, stale-while-revalidate=${cacheConfig.staleWhileRevalidate}`;
  }

  if (cacheConfig.cdnCacheKey) {
    headers['CDN-Cache-Key'] = cacheConfig.cdnCacheKey;
  }

  return headers;
};

// CDN health monitoring
let healthStatus: CDNHealthStatus = {
  status: 'healthy',
  latency: 0,
  lastCheck: new Date(),
};

export const checkCDNHealth = async (): Promise<CDNHealthStatus> => {
  if (!cdnConfig.enabled) {
    return {
      status: 'healthy',
      latency: 0,
      lastCheck: new Date(),
    };
  }

  try {
    const startTime = Date.now();

    // Use a lightweight endpoint to check CDN health
    const healthUrl = cdnConfig.baseUrl
      ? `${cdnConfig.baseUrl}/health`
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/health`;

    const response = await fetch(healthUrl, {
      method: 'HEAD',
      timeout: 5000,
    });

    const latency = Date.now() - startTime;

    healthStatus = {
      status: response.ok ? 'healthy' : 'degraded',
      latency,
      lastCheck: new Date(),
    };

    return healthStatus;
  } catch (error) {
    healthStatus = {
      status: 'down',
      latency: 0,
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : 'CDN health check failed',
    };
    return healthStatus;
  }
};

// Get CDN status with automatic fallback
export const getOptimizedMediaUrl = async (
  supabaseUrl: string,
  bucket: MediaBucket,
  optimization?: CDNOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  if (!cdnConfig.enabled) {
    return { url: supabaseUrl, source: 'supabase' };
  }

  // Check CDN health
  const health = await checkCDNHealth();

  if (health.status === 'down' && cdnConfig.fallbackToSupabase) {
    return { url: supabaseUrl, source: 'supabase' };
  }

  if (health.status === 'healthy' || health.status === 'degraded') {
    try {
      const cdnUrl = transformCDNUrl(supabaseUrl, bucket, optimization);
      return { url: cdnUrl, source: 'cdn' };
    } catch (error) {
      if (cdnConfig.fallbackToSupabase) {
        return { url: supabaseUrl, source: 'supabase' };
      }
      throw error;
    }
  }

  // Fallback to Supabase if CDN is not healthy
  return { url: supabaseUrl, source: 'supabase' };
};

// Upload progress tracking
export interface UploadProgress {
  progress: number;
  speed: number;
  eta: number;
  status: 'uploading' | 'completed' | 'failed' | 'paused';
}

// CDN upload manager
export class CDNUploadManager {
  private uploadProgressMap: Map<string, UploadProgress> = new Map();

  async uploadToCDN(
    file: File,
    bucket: MediaBucket,
    path: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ url: string; source: 'cdn' | 'supabase' }> {
    if (!cdnConfig.enabled || !cdnConfig.baseUrl) {
      // Fallback to Supabase upload
      return this.uploadToSupabase(file, bucket, path);
    }

    const uploadId = crypto.randomUUID();

    try {
      // Simulate CDN upload (in real implementation, this would use actual CDN API)
      const cdnUrl = await this.performCDNUpload(file, bucket, path, uploadId, onProgress);

      if (cdnUrl) {
        return { url: cdnUrl, source: 'cdn' };
      } else if (cdnConfig.fallbackToSupabase) {
        return this.uploadToSupabase(file, bucket, path);
      } else {
        throw new Error('CDN upload failed and fallback is disabled');
      }
    } catch (error) {
      this.updateUploadProgress(uploadId, {
        progress: 0,
        speed: 0,
        eta: 0,
        status: 'failed',
      });

      if (cdnConfig.fallbackToSupabase) {
        return this.uploadToSupabase(file, bucket, path);
      }
      throw error;
    }
  }

  private async performCDNUpload(
    file: File,
    bucket: MediaBucket,
    path: string,
    uploadId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string | null> {
    // This is a mock implementation - in real scenario, this would use actual CDN API
    const totalSize = file.size;
    let uploadedSize = 0;

    // Simulate chunked upload
    const chunkSize = Math.min(totalSize / 10, 1024 * 1024); // 1MB chunks or 10 chunks
    const chunks = Math.ceil(totalSize / chunkSize);

    for (let i = 0; i < chunks; i++) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate upload delay

      uploadedSize = Math.min((i + 1) * chunkSize, totalSize);
      const progress = (uploadedSize / totalSize) * 100;
      const speed = chunkSize / 0.1; // Mock speed calculation
      const eta = (totalSize - uploadedSize) / speed / 1000; // Mock ETA

      this.updateUploadProgress(uploadId, {
        progress,
        speed,
        eta,
        status: 'uploading',
      });

      if (onProgress) {
        onProgress(this.getUploadProgress(uploadId));
      }
    }

    // Generate CDN URL
    const cdnUrl = `${cdnConfig.baseUrl}/${bucket}/${path}`;
    this.updateUploadProgress(uploadId, {
      progress: 100,
      speed: 0,
      eta: 0,
      status: 'completed',
    });

    return cdnUrl;
  }

  private async uploadToSupabase(
    file: File,
    bucket: MediaBucket,
    path: string
  ): Promise<{ url: string; source: 'supabase' }> {
    // This would use the existing Supabase upload logic
    // For now, return a placeholder
    const supabaseUrl = `https://your-project.supabase.co/storage/v1/object/public/${bucket}/${path}`;
    return { url: supabaseUrl, source: 'supabase' };
  }

  private updateUploadProgress(uploadId: string, progress: UploadProgress): void {
    this.uploadProgressMap.set(uploadId, progress);
  }

  getUploadProgress(uploadId: string): UploadProgress | undefined {
    return this.uploadProgressMap.get(uploadId);
  }

  removeUploadProgress(uploadId: string): void {
    this.uploadProgressMap.delete(uploadId);
  }
}

export const cdnUploadManager = new CDNUploadManager();

// Utility functions for different media types
export const getOptimizedImageUrl = (
  supabaseUrl: string,
  bucket: MediaBucket,
  optimization?: CDNOptimizationParams
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  return getOptimizedMediaUrl(supabaseUrl, bucket, optimization);
};

export const getOptimizedAudioUrl = (
  supabaseUrl: string,
  bucket: MediaBucket
): Promise<{ url: string; source: 'cdn' | 'supabase' }> => {
  return getOptimizedMediaUrl(supabaseUrl, bucket);
};

// Lazy loading utilities
export const createLazyImageLoader = () => {
  if (typeof window === 'undefined' || !cdnConfig.optimization.lazyLoading) {
    return (url: string) => url;
  }

  return (url: string): string => {
    // For lazy loading, we could implement intersection observer logic
    // For now, just return the URL as-is
    return url;
  };
};

export const lazyImageUrl = createLazyImageLoader();

// Export constants
export const CDN_PROVIDERS = {
  CLOUDFLARE: 'cloudflare',
  AWS_CLOUDFRONT: 'aws-cloudfront',
  CUSTOM: 'custom',
  SUPABASE: 'supabase',
} as const;

export const CDN_STATUSES = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  DOWN: 'down',
} as const;
