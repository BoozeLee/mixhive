import { createClient } from '@supabase/supabase-js';
import { Database } from './mixhive-database.types';

// Supabase client instance
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Storage bucket types
export interface StorageFile {
  id: string;
  name: string;
  size: number;
  mimetype: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface UploadOptions {
  upsert?: boolean;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface CDNTransformations {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number;
  format?: 'jpg' | 'png' | 'webp' | 'avif';
  crop?: string;
  gravity?:
    | 'north'
    | 'northeast'
    | 'east'
    | 'southeast'
    | 'south'
    | 'southwest'
    | 'west'
    | 'northwest'
    | 'center';
}

// Storage bucket manager
export class StorageManager {
  private bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  // Upload a file to storage
  async uploadFile(
    path: string,
    file: File | Blob,
    options: UploadOptions = {}
  ): Promise<{ data: StorageFile | null; error: Error | null }> {
    const { error } = await supabase.storage.from(this.bucket).upload(path, file, {
      upsert: options.upsert || false,
      contentType: options.contentType,
      metadata: options.metadata,
    });

    if (error) {
      console.error('Storage upload error:', error);
      return { data: null, error };
    }

    // Get file info after upload
    const { data: fileInfo } = await supabase.storage.from(this.bucket).getPublicUrl(path);

    return { data: fileInfo.data, error: null };
  }

  // Download a file from storage
  async downloadFile(path: string): Promise<{ data: Blob | null; error: Error | null }> {
    const { data, error } = await supabase.storage.from(this.bucket).download(path);

    if (error) {
      console.error('Storage download error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  }

  // Get public URL for a file
  getPublicUrl(path: string, transformations?: CDNTransformations): string {
    const { data } = supabase.storage.from(this.bucket).getPublicUrl(path);

    // Apply transformations if provided
    if (transformations) {
      const params = new URLSearchParams();

      if (transformations.width) params.set('w', transformations.width.toString());
      if (transformations.height) params.set('h', transformations.height.toString());
      if (transformations.fit) params.set('fit', transformations.fit);
      if (transformations.quality) params.set('q', transformations.quality.toString());
      if (transformations.format) params.set('fm', transformations.format);
      if (transformations.crop) params.set('crop', transformations.crop);
      if (transformations.gravity) params.set('g', transformations.gravity);

      if (params.toString()) {
        return `${data.publicUrl}?${params.toString()}`;
      }
    }

    return data.publicUrl;
  }

  // Delete a file from storage
  async deleteFile(path: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.storage.from(this.bucket).remove([path]);

    if (error) {
      console.error('Storage delete error:', error);
      return { error };
    }

    return { error: null };
  }

  // List files in a storage path
  async listFiles(
    path: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: { column: 'name' | 'size' | 'updated_at'; order: 'asc' | 'desc' };
    } = {}
  ): Promise<{ data: StorageFile[] | null; error: Error | null }> {
    const { limit = 100, offset = 0, sortBy } = options;

    let query = supabase.storage.from(this.bucket).list(path, { limit, offset });

    if (sortBy) {
      query = query.order(sortBy.column, { ascending: sortBy.order === 'asc' });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Storage list error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  }

  // Check if a file exists
  async fileExists(path: string): Promise<boolean> {
    const { data, error } = await supabase.storage.from(this.bucket).getPublicUrl(path);

    return !error && data.publicUrl !== null;
  }
}

// Bucket-specific managers
export const avatarStorage = new StorageManager('avatars');
export const bannerStorage = new StorageManager('banners');
export const mixStorage = new StorageManager('mixes');
export const artworkStorage = new StorageManager('artwork');
export const buzzMediaStorage = new StorageManager('buzz-media');

// Avatar management functions
export async function uploadAvatar(
  userId: string,
  avatarFile: File,
  options: UploadOptions = {}
): Promise<{ url: string | null; error: Error | null }> {
  const path = `${userId}/avatar.${avatarFile.type.split('/')[1]}`;

  const { error } = await avatarStorage.uploadFile(path, avatarFile, {
    ...options,
    metadata: {
      userId,
      ...options.metadata,
    },
  });

  if (error) {
    return { url: null, error };
  }

  const url = avatarStorage.getPublicUrl(path, {
    width: 200,
    height: 200,
    fit: 'cover',
    format: 'webp',
  });

  return { url, error: null };
}

export async function getAvatarUrl(userId: string, size: number = 200): string {
  return avatarStorage.getPublicUrl(`${userId}/avatar.jpg`, {
    width: size,
    height: size,
    fit: 'cover',
    format: 'webp',
  });
}

export async function deleteAvatar(userId: string): Promise<{ error: Error | null }> {
  const path = `${userId}/avatar.jpg`;
  return await avatarStorage.deleteFile(path);
}

// Banner management functions
export async function uploadBanner(
  userId: string,
  bannerFile: File,
  options: UploadOptions = {}
): Promise<{ url: string | null; error: Error | null }> {
  const path = `${userId}/banner.${bannerFile.type.split('/')[1]}`;

  const { error } = await bannerStorage.uploadFile(path, bannerFile, {
    ...options,
    metadata: {
      userId,
      ...options.metadata,
    },
  });

  if (error) {
    return { url: null, error };
  }

  const url = bannerStorage.getPublicUrl(path, {
    width: 1200,
    height: 300,
    fit: 'cover',
    format: 'webp',
  });

  return { url, error: null };
}

export async function getBannerUrl(
  userId: string,
  width: number = 1200,
  height: number = 300
): string {
  return bannerStorage.getPublicUrl(`${userId}/banner.jpg`, {
    width,
    height,
    fit: 'cover',
    format: 'webp',
  });
}

export async function deleteBanner(userId: string): Promise<{ error: Error | null }> {
  const path = `${userId}/banner.jpg`;
  return await bannerStorage.deleteFile(path);
}

// Mix management functions
export async function uploadMix(
  userId: string,
  mixFile: File,
  metadata: Record<string, unknown> = {}
): Promise<{ url: string | null; error: Error | null }> {
  const path = `${userId}/mixes/${Date.now()}-${mixFile.name}`;

  const { error } = await mixStorage.uploadFile(path, mixFile, {
    metadata: {
      userId,
      uploadDate: new Date().toISOString(),
      ...metadata,
    },
  });

  if (error) {
    return { url: null, error };
  }

  const url = mixStorage.getPublicUrl(path);
  return { url, error: null };
}

export async function getMixUrl(mixPath: string): string {
  return mixStorage.getPublicUrl(mixPath);
}

export async function deleteMix(userId: string, mixPath: string): Promise<{ error: Error | null }> {
  return await mixStorage.deleteFile(mixPath);
}

// Artwork management functions
export async function uploadArtwork(
  userId: string,
  mixId: string,
  artworkFile: File,
  options: UploadOptions = {}
): Promise<{ url: string | null; error: Error | null }> {
  const path = `${userId}/mixes/${mixId}/artwork.${artworkFile.type.split('/')[1]}`;

  const { error } = await artworkStorage.uploadFile(path, artworkFile, {
    ...options,
    metadata: {
      userId,
      mixId,
      uploadDate: new Date().toISOString(),
      ...options.metadata,
    },
  });

  if (error) {
    return { url: null, error };
  }

  const url = artworkStorage.getPublicUrl(path, {
    width: 500,
    height: 500,
    fit: 'cover',
    format: 'webp',
  });

  return { url, error: null };
}

export async function getArtworkUrl(userId: string, mixId: string, size: number = 500): string {
  return artworkStorage.getPublicUrl(`${userId}/mixes/${mixId}/artwork.jpg`, {
    width: size,
    height: size,
    fit: 'cover',
    format: 'webp',
  });
}

export async function deleteArtwork(
  userId: string,
  mixId: string
): Promise<{ error: Error | null }> {
  const path = `${userId}/mixes/${mixId}/artwork.jpg`;
  return await artworkStorage.deleteFile(path);
}

// Buzz media management functions
export async function uploadBuzzMedia(
  userId: string,
  mediaFile: File,
  mediaType: 'image' | 'video',
  options: UploadOptions = {}
): Promise<{ url: string | null; error: Error | null }> {
  const extension = mediaType === 'image' ? 'jpg' : 'mp4';
  const path = `${userId}/buzz/${Date.now()}.${extension}`;

  const { error } = await buzzMediaStorage.uploadFile(path, mediaFile, {
    ...options,
    metadata: {
      userId,
      mediaType,
      uploadDate: new Date().toISOString(),
      ...options.metadata,
    },
  });

  if (error) {
    return { url: null, error };
  }

  const url = buzzMediaStorage.getPublicUrl(
    path,
    mediaType === 'image'
      ? {
          width: 800,
          height: 800,
          fit: 'cover',
          format: 'webp',
        }
      : {
          width: 640,
          height: 480,
          format: 'webm',
          quality: 80,
        }
  );

  return { url, error: null };
}

export async function getBuzzMediaUrl(
  userId: string,
  mediaId: string,
  mediaType: 'image' | 'video'
): string {
  const extension = mediaType === 'image' ? 'jpg' : 'mp4';
  return buzzMediaStorage.getPublicUrl(
    `${userId}/buzz/${mediaId}.${extension}`,
    mediaType === 'image'
      ? {
          width: 800,
          height: 800,
          fit: 'cover',
          format: 'webp',
        }
      : {
          width: 640,
          height: 480,
          format: 'webm',
          quality: 80,
        }
  );
}

export async function deleteBuzzMedia(
  userId: string,
  mediaId: string
): Promise<{ error: Error | null }> {
  const path = `${userId}/buzz/${mediaId}`;
  return await buzzMediaStorage.deleteFile(path);
}

// Storage utilities
export async function getUserStorageUsage(userId: string): Promise<{
  avatars: { count: number; size: number };
  banners: { count: number; size: number };
  mixes: { count: number; size: number };
  artwork: { count: number; size: number };
  buzzMedia: { count: number; size: number };
  total: { count: number; size: number };
}> {
  const buckets = ['avatars', 'banners', 'mixes', 'artwork', 'buzz-media'] as const;

  const usage = await Promise.all(
    buckets.map(async bucket => {
      const storage = new StorageManager(bucket);
      const files = await storage.listFiles(userId);

      if (files.error || !files.data) {
        return { count: 0, size: 0 };
      }

      const totalSize = files.data.reduce((sum, file) => sum + file.size, 0);
      return {
        count: files.data.length,
        size: totalSize,
      };
    })
  );

  const result = {
    avatars: usage[0],
    banners: usage[1],
    mixes: usage[2],
    artwork: usage[3],
    buzzMedia: usage[4],
    total: {
      count: usage.reduce((sum, u) => sum + u.count, 0),
      size: usage.reduce((sum, u) => sum + u.size, 0),
    },
  };

  return result;
}

export async function cleanupUserStorage(userId: string): Promise<{ error: Error | null }> {
  const buckets = ['avatars', 'banners', 'mixes', 'artwork', 'buzz-media'] as const;

  const errors = [];

  for (const bucket of buckets) {
    const storage = new StorageManager(bucket);
    const files = await storage.listFiles(userId);

    if (files.error) {
      errors.push(files.error);
      continue;
    }

    if (files.data) {
      for (const file of files.data) {
        const { error } = await storage.deleteFile(file.name);
        if (error) {
          errors.push(error);
        }
      }
    }
  }

  return errors.length > 0 ? { error: errors } : { error: null };
}
