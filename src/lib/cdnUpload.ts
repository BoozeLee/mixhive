/**
 * Enhanced CDN Upload Functions
 *
 * Provides CDN-aware upload functionality with fallback mechanisms,
 * progress tracking, and optimization features.
 */

import { supabase } from './supabase';
import { cdnUploadManager, getOptimizedMediaUrl, getCDNCacheHeaders } from './cdn';
import type { UploadProgress, CDNOptimizationParams, MediaBucket } from './cdn';
import type {
  AudioOptimizationParams,
  ImageOptimizationParams,
  VideoOptimizationParams,
} from './cdnUrlTransformers';

// Export bucket constants for consistency
export {
  AUDIO_BUCKET,
  ARTWORK_BUCKET,
  WAVEFORM_BUCKET,
  AVATAR_BUCKET,
  BANNER_BUCKET,
  BUZZ_MEDIA_BUCKET,
} from './api';

interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  enableCDN?: boolean;
  optimization?: CDNOptimizationParams;
  retryAttempts?: number;
  timeout?: number;
}

interface UploadResult {
  url: string;
  source: 'cdn' | 'supabase';
  cdnOptimized?: boolean;
  cacheHeaders?: Record<string, string>;
  uploadTime: number;
  fileSize: number;
}

// Enhanced audio upload with CDN support
export async function uploadAudioWithCDN(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult | null> {
  if (!supabase) return null;

  const startTime = Date.now();
  const bucket = 'mix-audio';
  const path = `mixes/${crypto.randomUUID()}.${file.name.split('.').pop()}`;

  try {
    // Try CDN upload first if enabled
    if (options.enableCDN !== false) {
      try {
        const cdnResult = await cdnUploadManager.uploadToCDN(
          file,
          bucket as MediaBucket,
          path,
          options.onProgress
        );

        // Get optimized URL and cache headers
        const optimizationResult = await getOptimizedMediaUrl(
          cdnResult.url,
          bucket as MediaBucket,
          options.optimization
        );

        return {
          url: optimizationResult.url,
          source: optimizationResult.source,
          cdnOptimized: true,
          cacheHeaders: getCDNCacheHeaders(bucket as MediaBucket),
          uploadTime: Date.now() - startTime,
          fileSize: file.size,
        };
      } catch (cdnError) {
        console.warn('CDN upload failed, falling back to Supabase:', cdnError);
        // Continue to Supabase fallback
      }
    }

    // Fallback to Supabase upload
    const { data } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });

    if (!data) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      url: publicUrl,
      source: 'supabase',
      cdnOptimized: false,
      uploadTime: Date.now() - startTime,
      fileSize: file.size,
    };
  } catch (error) {
    console.error('Audio upload failed:', error);
    return null;
  }
}

// Enhanced artwork upload with CDN support
export async function uploadArtworkWithCDN(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult | null> {
  if (!supabase) return null;

  const startTime = Date.now();
  const bucket = 'mix-artwork';
  const path = `artwork/${crypto.randomUUID()}.${file.name.split('.').pop()}`;

  try {
    // Try CDN upload first if enabled
    if (options.enableCDN !== false) {
      try {
        const cdnResult = await cdnUploadManager.uploadToCDN(
          file,
          bucket as MediaBucket,
          path,
          options.onProgress
        );

        // Get optimized URL and cache headers
        const imageOptimization: ImageOptimizationParams = {
          format: 'webp',
          quality: 85,
          ...options.optimization,
        };

        const optimizationResult = await getOptimizedMediaUrl(
          cdnResult.url,
          bucket as MediaBucket,
          imageOptimization
        );

        return {
          url: optimizationResult.url,
          source: optimizationResult.source,
          cdnOptimized: true,
          cacheHeaders: getCDNCacheHeaders(bucket as MediaBucket),
          uploadTime: Date.now() - startTime,
          fileSize: file.size,
        };
      } catch (cdnError) {
        console.warn('CDN upload failed, falling back to Supabase:', cdnError);
        // Continue to Supabase fallback
      }
    }

    // Fallback to Supabase upload
    const { data } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });

    if (!data) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      url: publicUrl,
      source: 'supabase',
      cdnOptimized: false,
      uploadTime: Date.now() - startTime,
      fileSize: file.size,
    };
  } catch (error) {
    console.error('Artwork upload failed:', error);
    return null;
  }
}

// Enhanced buzz media upload with CDN support
export async function uploadBuzzMediaWithCDN(
  file: File,
  mediaType: 'image' | 'audio' | 'video' = 'image',
  options: UploadOptions = {}
): Promise<UploadResult | null> {
  if (!supabase) return null;

  const startTime = Date.now();
  const bucket = 'buzz-media';
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  const ext = file.name.split('.').pop();
  const path = uid
    ? `${uid}/${crypto.randomUUID()}.${ext}`
    : `public/${crypto.randomUUID()}.${ext}`;

  try {
    // Try CDN upload first if enabled
    if (options.enableCDN !== false) {
      try {
        const cdnResult = await cdnUploadManager.uploadToCDN(
          file,
          bucket as MediaBucket,
          path,
          options.onProgress
        );

        // Get optimization based on media type
        let optimization: CDNOptimizationParams = {};

        switch (mediaType) {
          case 'image':
            optimization = {
              format: 'webp',
              quality: 75,
              ...options.optimization,
            };
            break;
          case 'audio':
            optimization = {
              format: 'mp3',
              quality: 128,
              ...options.optimization,
            };
            break;
          case 'video':
            optimization = {
              format: 'webm',
              quality: 80,
              ...options.optimization,
            };
            break;
        }

        const optimizationResult = await getOptimizedMediaUrl(
          cdnResult.url,
          bucket as MediaBucket,
          optimization
        );

        return {
          url: optimizationResult.url,
          source: optimizationResult.source,
          cdnOptimized: true,
          cacheHeaders: getCDNCacheHeaders(bucket as MediaBucket),
          uploadTime: Date.now() - startTime,
          fileSize: file.size,
        };
      } catch (cdnError) {
        console.warn('CDN upload failed, falling back to Supabase:', cdnError);
        // Continue to Supabase fallback
      }
    }

    // Fallback to Supabase upload
    const { data } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });

    if (!data) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      url: publicUrl,
      source: 'supabase',
      cdnOptimized: false,
      uploadTime: Date.now() - startTime,
      fileSize: file.size,
    };
  } catch (error) {
    console.error('Buzz media upload failed:', error);
    return null;
  }
}

// Enhanced profile picture upload with CDN support
export async function uploadAvatarWithCDN(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult | null> {
  if (!supabase) return null;

  const startTime = Date.now();
  const bucket = 'profile-avatars';
  const path = `avatars/${crypto.randomUUID()}.${file.name.split('.').pop()}`;

  try {
    // Try CDN upload first if enabled
    if (options.enableCDN !== false) {
      try {
        const cdnResult = await cdnUploadManager.uploadToCDN(
          file,
          bucket as MediaBucket,
          path,
          options.onProgress
        );

        // Get optimized URL with avatar-specific optimization
        const optimization = {
          format: 'webp',
          quality: 80,
          width: 200,
          height: 200,
          ...options.optimization,
        };

        const optimizationResult = await getOptimizedMediaUrl(
          cdnResult.url,
          bucket as MediaBucket,
          optimization
        );

        return {
          url: optimizationResult.url,
          source: optimizationResult.source,
          cdnOptimized: true,
          cacheHeaders: getCDNCacheHeaders(bucket as MediaBucket),
          uploadTime: Date.now() - startTime,
          fileSize: file.size,
        };
      } catch (cdnError) {
        console.warn('CDN upload failed, falling back to Supabase:', cdnError);
        // Continue to Supabase fallback
      }
    }

    // Fallback to Supabase upload
    const { data } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });

    if (!data) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      url: publicUrl,
      source: 'supabase',
      cdnOptimized: false,
      uploadTime: Date.now() - startTime,
      fileSize: file.size,
    };
  } catch (error) {
    console.error('Avatar upload failed:', error);
    return null;
  }
}

// Enhanced profile banner upload with CDN support
export async function uploadBannerWithCDN(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult | null> {
  if (!supabase) return null;

  const startTime = Date.now();
  const bucket = 'profile-banners';
  const path = `banners/${crypto.randomUUID()}.${file.name.split('.').pop()}`;

  try {
    // Try CDN upload first if enabled
    if (options.enableCDN !== false) {
      try {
        const cdnResult = await cdnUploadManager.uploadToCDN(
          file,
          bucket as MediaBucket,
          path,
          options.onProgress
        );

        // Get optimized URL with banner-specific optimization
        const optimization = {
          format: 'webp',
          quality: 90,
          width: 1200,
          height: 400,
          ...options.optimization,
        };

        const optimizationResult = await getOptimizedMediaUrl(
          cdnResult.url,
          bucket as MediaBucket,
          optimization
        );

        return {
          url: optimizationResult.url,
          source: optimizationResult.source,
          cdnOptimized: true,
          cacheHeaders: getCDNCacheHeaders(bucket as MediaBucket),
          uploadTime: Date.now() - startTime,
          fileSize: file.size,
        };
      } catch (cdnError) {
        console.warn('CDN upload failed, falling back to Supabase:', cdnError);
        // Continue to Supabase fallback
      }
    }

    // Fallback to Supabase upload
    const { data } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });

    if (!data) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      url: publicUrl,
      source: 'supabase',
      cdnOptimized: false,
      uploadTime: Date.now() - startTime,
      fileSize: file.size,
    };
  } catch (error) {
    console.error('Banner upload failed:', error);
    return null;
  }
}

// Enhanced waveform upload with CDN support
export async function uploadWaveformWithCDN(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult | null> {
  if (!supabase) return null;

  const startTime = Date.now();
  const bucket = 'mix-waveforms';
  const path = `waveforms/${crypto.randomUUID()}.${file.name.split('.').pop()}`;

  try {
    // Try CDN upload first if enabled
    if (options.enableCDN !== false) {
      try {
        const cdnResult = await cdnUploadManager.uploadToCDN(
          file,
          bucket as MediaBucket,
          path,
          options.onProgress
        );

        // Get optimized URL with waveform-specific optimization
        const optimization = {
          format: 'png',
          quality: 90,
          width: 1200,
          height: 200,
          ...options.optimization,
        };

        const optimizationResult = await getOptimizedMediaUrl(
          cdnResult.url,
          bucket as MediaBucket,
          optimization
        );

        return {
          url: optimizationResult.url,
          source: optimizationResult.source,
          cdnOptimized: true,
          cacheHeaders: getCDNCacheHeaders(bucket as MediaBucket),
          uploadTime: Date.now() - startTime,
          fileSize: file.size,
        };
      } catch (cdnError) {
        console.warn('CDN upload failed, falling back to Supabase:', cdnError);
        // Continue to Supabase fallback
      }
    }

    // Fallback to Supabase upload
    const { data } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });

    if (!data) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      url: publicUrl,
      source: 'supabase',
      cdnOptimized: false,
      uploadTime: Date.now() - startTime,
      fileSize: file.size,
    };
  } catch (error) {
    console.error('Waveform upload failed:', error);
    return null;
  }
}

// Batch upload with progress tracking
export async function batchUploadWithCDN(
  files: Array<{
    file: File;
    type: 'audio' | 'artwork' | 'buzz' | 'avatar' | 'banner' | 'waveform';
    mediaType?: 'image' | 'audio' | 'video'; // for buzz media
  }>,
  options: UploadOptions = {}
): Promise<Array<UploadResult | null>> {
  const results: Array<UploadResult | null> = [];
  const totalFiles = files.length;

  for (let i = 0; i < files.length; i++) {
    const { file, type, mediaType = 'image' } = files[i];

    // Update progress if callback provided
    if (options.onProgress) {
      options.onProgress({
        progress: (i / totalFiles) * 100,
        speed: 0,
        eta: (totalFiles - i) * 2, // Mock ETA
        status: 'uploading',
      });
    }

    let result: UploadResult | null = null;

    try {
      switch (type) {
        case 'audio':
          result = await uploadAudioWithCDN(file, options);
          break;
        case 'artwork':
          result = await uploadArtworkWithCDN(file, options);
          break;
        case 'buzz':
          result = await uploadBuzzMediaWithCDN(file, mediaType, options);
          break;
        case 'avatar':
          result = await uploadAvatarWithCDN(file, options);
          break;
        case 'banner':
          result = await uploadBannerWithCDN(file, options);
          break;
        case 'waveform':
          result = await uploadWaveformWithCDN(file, options);
          break;
        default:
          throw new Error(`Unsupported upload type: ${type}`);
      }

      results.push(result);
    } catch (error) {
      console.error(`Batch upload failed for file ${file.name}:`, error);
      results.push(null);
    }
  }

  // Mark upload as completed
  if (options.onProgress) {
    options.onProgress({
      progress: 100,
      speed: 0,
      eta: 0,
      status: 'completed',
    });
  }

  return results;
}

// File validation utilities
export const validateUploadFile = (file: File, type: 'audio' | 'image' | 'video'): boolean => {
  const maxSize =
    type === 'audio'
      ? 100 * 1024 * 1024 // 100MB for audio
      : type === 'video'
        ? 500 * 1024 * 1024 // 500MB for video
        : 10 * 1024 * 1024; // 10MB for images

  if (file.size > maxSize) {
    console.error(`File ${file.name} exceeds maximum size of ${maxSize} bytes`);
    return false;
  }

  // Basic MIME type validation
  const allowedMimeTypes = {
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac'],
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
  };

  if (!allowedMimeTypes[type].includes(file.type)) {
    console.error(`File ${file.name} has unsupported MIME type: ${file.type}`);
    return false;
  }

  return true;
};

// Get upload recommendations based on file type and size
export const getUploadRecommendations = (file: File, type: 'audio' | 'image' | 'video') => {
  const recommendations = [];

  // Size recommendations
  if (file.size > 50 * 1024 * 1024) {
    // 50MB
    recommendations.push('Consider compressing the file for faster upload and better performance');
  }

  // Format recommendations
  if (type === 'image' && file.type !== 'image/webp') {
    recommendations.push('WebP format is recommended for better compression and quality');
  }

  if (type === 'audio' && file.type !== 'audio/mpeg') {
    recommendations.push('MP3 format is recommended for better compatibility and compression');
  }

  // CDN optimization recommendations
  if (file.size > 10 * 1024 * 1024) {
    // 10MB
    recommendations.push('Large files benefit significantly from CDN optimization');
  }

  return recommendations;
};

// Export all upload functions
export const UPLOAD_FUNCTIONS = {
  uploadAudioWithCDN,
  uploadArtworkWithCDN,
  uploadBuzzMediaWithCDN,
  uploadAvatarWithCDN,
  uploadBannerWithCDN,
  uploadWaveformWithCDN,
  batchUploadWithCDN,
  validateUploadFile,
  getUploadRecommendations,
} as const;
