-- MixHive Storage Buckets Configuration
-- This script creates and configures separate storage buckets for different media types

-- Create storage buckets with specific configurations

-- 1. Avatars Bucket (for user profile pictures)
-- Max file size: 5MB, allowed formats: images only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ])
ON CONFLICT (id) DO NOTHING;

-- 2. Banners Bucket (for profile banners)
-- Max file size: 10MB, allowed formats: images with specific aspect ratio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('banners', 'banners', true, 10485760, ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ])
ON CONFLICT (id) DO NOTHING;

-- 3. Mixes Bucket (for audio files)
-- Max file size: 500MB, allowed formats: audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('mixes', 'mixes', false, 524288000, ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/webm'
  ])
ON CONFLICT (id) DO NOTHING;

-- 4. Artwork Bucket (for mix artwork)
-- Max file size: 10MB, allowed formats: square images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('artwork', 'artwork', true, 10485760, ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ])
ON CONFLICT (id) DO NOTHING;

-- 5. Buzz Media Bucket (for Buzz post images/videos)
-- Max file size: 50MB, allowed formats: images and videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('buzz-media', 'buzz-media', true, 52428800, ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for each bucket

-- Avatars Bucket Policies
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Public read access for avatars
CREATE POLICY "Public access to avatars" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'avatars' AND 
        (storage.foldername(name))[1] != 'private'
    );

-- Users can upload their own avatars
CREATE POLICY "Users can upload own avatars" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own avatars
CREATE POLICY "Users can update own avatars" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own avatars
CREATE POLICY "Users can delete own avatars" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Banners Bucket Policies
-- Public read access for banners
CREATE POLICY "Public access to banners" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'banners' AND 
        (storage.foldername(name))[1] != 'private'
    );

-- Users can upload their own banners
CREATE POLICY "Users can upload own banners" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'banners' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own banners
CREATE POLICY "Users can update own banners" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'banners' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own banners
CREATE POLICY "Users can delete own banners" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'banners' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Mixes Bucket Policies (Private access)
-- Users can access their own mixes
CREATE POLICY "Users can access own mixes" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'mixes' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can upload their own mixes
CREATE POLICY "Users can upload own mixes" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'mixes' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own mixes
CREATE POLICY "Users can update own mixes" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'mixes' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own mixes
CREATE POLICY "Users can delete own mixes" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'mixes' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Artwork Bucket Policies
-- Public read access for artwork
CREATE POLICY "Public access to artwork" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'artwork' AND 
        (storage.foldername(name))[1] != 'private'
    );

-- Users can upload their own artwork
CREATE POLICY "Users can upload own artwork" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'artwork' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own artwork
CREATE POLICY "Users can update own artwork" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'artwork' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own artwork
CREATE POLICY "Users can delete own artwork" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'artwork' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Buzz Media Bucket Policies
-- Public read access for buzz media
CREATE POLICY "Public access to buzz media" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'buzz-media' AND 
        (storage.foldername(name))[1] != 'private'
    );

-- Users can upload their own buzz media
CREATE POLICY "Users can upload own buzz media" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'buzz-media' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own buzz media
CREATE POLICY "Users can update own buzz media" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'buzz-media' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own buzz media
CREATE POLICY "Users can delete own buzz media" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'buzz-media' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Create CDN integration functions for optimized URLs

-- Function to get CDN URL with transformations
CREATE OR REPLACE FUNCTION get_cdn_url(
    bucket_name TEXT,
    file_path TEXT,
    transformations JSONB DEFAULT '{}'
) RETURNS TEXT AS $$
DECLARE
    base_url TEXT;
    cdn_config TEXT;
BEGIN
    -- Get CDN configuration from settings
    SELECT value INTO cdn_config FROM supabase.storage.settings WHERE key = 'cdn_url';
    
    IF cdn_config IS NULL THEN
        -- Fallback to direct storage URL
        base_url := supabase.storage.get_url(bucket_name, file_path);
    ELSE
        -- Construct CDN URL with transformations
        base_url := cdn_config || '/' || bucket_name || '/' || file_path;
        
        -- Add transformations if provided
        IF transformations IS NOT NULL AND jsonb_typeof(transformations) = 'object' THEN
            -- Build transformation query string
            WITH transformed_params AS (
                SELECT string_agg(key || '=' || value, '&') AS query_string
                FROM jsonb_each(transformations)
            )
            SELECT 
                base_url || 
                CASE WHEN query_string IS NOT NULL THEN '?' || query_string ELSE '' END
            INTO base_url
            FROM transformed_params;
        END IF;
    END IF;
    
    RETURN base_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get optimized avatar URL
CREATE OR REPLACE FUNCTION get_avatar_url(user_id TEXT, size INTEGER DEFAULT 200) RETURNS TEXT AS $$
BEGIN
    RETURN get_cdn_url('avatars', user_id || '/avatar.jpg', 
        jsonb_build_object(
            'width', size,
            'height', size,
            'fit', 'cover',
            'format', 'webp'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get optimized banner URL
CREATE OR REPLACE FUNCTION get_banner_url(user_id TEXT, width INTEGER DEFAULT 1200, height INTEGER DEFAULT 300) RETURNS TEXT AS $$
BEGIN
    RETURN get_cdn_url('banners', user_id || '/banner.jpg', 
        jsonb_build_object(
            'width', width,
            'height', height,
            'fit', 'cover',
            'format', 'webp'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get optimized artwork URL
CREATE OR REPLACE FUNCTION get_artwork_url(mix_id TEXT, size INTEGER DEFAULT 500) RETURNS TEXT AS $$
BEGIN
    RETURN get_cdn_url('artwork', mix_id || '/artwork.jpg', 
        jsonb_build_object(
            'width', size,
            'height', size,
            'fit', 'cover',
            'format', 'webp'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get buzz media URL with optimization
CREATE OR REPLACE FUNCTION get_buzz_media_url(user_id TEXT, media_id TEXT, media_type TEXT) RETURNS TEXT AS $$
BEGIN
    CASE media_type
        WHEN 'image' THEN
            RETURN get_cdn_url('buzz-media', user_id || '/' || media_id || '.jpg', 
                jsonb_build_object(
                    'width', 800,
                    'height', 800,
                    'fit', 'cover',
                    'format', 'webp'
                )
            );
        WHEN 'video' THEN
            RETURN get_cdn_url('buzz-media', user_id || '/' || media_id || '.mp4', 
                jsonb_build_object(
                    'width', 640,
                    'height', 480,
                    'format', 'webm',
                    'quality', '80'
                )
            );
        ELSE
            RETURN get_cdn_url('buzz-media', user_id || '/' || media_id);
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic file processing

-- Trigger to validate avatar uploads
CREATE OR REPLACE FUNCTION validate_avatar_upload() RETURNS TRIGGER AS $$
BEGIN
    -- Check file size (5MB limit)
    IF NEW.size > 5242880 THEN
        RAISE EXCEPTION 'Avatar file size exceeds 5MB limit';
    END IF;
    
    -- Check file type
    IF NOT NEW.mime_type IN (
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
    ) THEN
        RAISE EXCEPTION 'Avatar must be an image file (JPEG, PNG, GIF, or WebP)';
    END IF;
    
    -- Check dimensions (minimum 100x100)
    IF NEW.metadata->>'width'::int < 100 OR NEW.metadata->>'height'::int < 100 THEN
        RAISE EXCEPTION 'Avatar must be at least 100x100 pixels';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_avatar_upload_trigger
    BEFORE INSERT OR UPDATE ON storage.objects
    FOR EACH ROW
    WHEN (NEW.bucket_id = 'avatars')
    EXECUTE FUNCTION validate_avatar_upload();

-- Trigger to validate banner uploads
CREATE OR REPLACE FUNCTION validate_banner_upload() RETURNS TRIGGER AS $$
BEGIN
    -- Check file size (10MB limit)
    IF NEW.size > 10485760 THEN
        RAISE EXCEPTION 'Banner file size exceeds 10MB limit';
    END IF;
    
    -- Check file type
    IF NOT NEW.mime_type IN (
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
    ) THEN
        RAISE EXCEPTION 'Banner must be an image file (JPEG, PNG, GIF, or WebP)';
    END IF;
    
    -- Check aspect ratio (recommended 4:1)
    DECLARE
        width INTEGER;
        height INTEGER;
        aspect_ratio NUMERIC;
    BEGIN
        width := NEW.metadata->>'width'::int;
        height := NEW.metadata->>'height'::int;
        
        IF width > 0 AND height > 0 THEN
            aspect_ratio := width::numeric / height::numeric;
            
            -- Acceptable aspect ratio range: 2:1 to 6:1
            IF aspect_ratio < 2 OR aspect_ratio > 6 THEN
                RAISE EXCEPTION 'Banner aspect ratio should be between 2:1 and 6:1 (recommended 4:1)';
            END IF;
        END IF;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_banner_upload_trigger
    BEFORE INSERT OR UPDATE ON storage.objects
    FOR EACH ROW
    WHEN (NEW.bucket_id = 'banners')
    EXECUTE FUNCTION validate_banner_upload();

-- Trigger to validate mix uploads
CREATE OR REPLACE FUNCTION validate_mix_upload() RETURNS TRIGGER AS $$
BEGIN
    -- Check file size (500MB limit)
    IF NEW.size > 524288000 THEN
        RAISE EXCEPTION 'Mix file size exceeds 500MB limit';
    END IF;
    
    -- Check file type
    IF NOT NEW.mime_type IN (
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 
        'audio/aac', 'audio/ogg', 'audio/webm'
    ) THEN
        RAISE EXCEPTION 'Mix must be an audio file (MP3, WAV, FLAC, AAC, OGG, or WebM)';
    END IF;
    
    -- Check minimum duration (30 seconds)
    IF NEW.metadata->>'duration'::int < 30 THEN
        RAISE EXCEPTION 'Mix must be at least 30 seconds long';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_mix_upload_trigger
    BEFORE INSERT OR UPDATE ON storage.objects
    FOR EACH ROW
    WHEN (NEW.bucket_id = 'mixes')
    EXECUTE FUNCTION validate_mix_upload();

-- Trigger to validate artwork uploads
CREATE OR REPLACE FUNCTION validate_artwork_upload() RETURNS TRIGGER AS $$
BEGIN
    -- Check file size (10MB limit)
    IF NEW.size > 10485760 THEN
        RAISE EXCEPTION 'Artwork file size exceeds 10MB limit';
    END IF;
    
    -- Check file type
    IF NOT NEW.mime_type IN (
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
    ) THEN
        RAISE EXCEPTION 'Artwork must be an image file (JPEG, PNG, GIF, or WebP)';
    END IF;
    
    -- Check minimum dimensions (500x500)
    IF NEW.metadata->>'width'::int < 500 OR NEW.metadata->>'height'::int < 500 THEN
        RAISE EXCEPTION 'Artwork must be at least 500x500 pixels';
    END IF;
    
    -- Check aspect ratio (square ±10%)
    DECLARE
        width INTEGER;
        height INTEGER;
        aspect_ratio NUMERIC;
    BEGIN
        width := NEW.metadata->>'width'::int;
        height := NEW.metadata->>'height'::int;
        
        IF width > 0 AND height > 0 THEN
            aspect_ratio := width::numeric / height::numeric;
            
            -- Acceptable aspect ratio: 0.9 to 1.1 (square ±10%)
            IF aspect_ratio < 0.9 OR aspect_ratio > 1.1 THEN
                RAISE EXCEPTION 'Artwork must be square (±10% tolerance)';
            END IF;
        END IF;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_artwork_upload_trigger
    BEFORE INSERT OR UPDATE ON storage.objects
    FOR EACH ROW
    WHEN (NEW.bucket_id = 'artwork')
    EXECUTE FUNCTION validate_artwork_upload();

-- Create utility functions for storage management

-- Function to delete user's storage files
CREATE OR REPLACE FUNCTION delete_user_storage_files(user_id TEXT) RETURNS void AS $$
BEGIN
    -- Delete avatar
    DELETE FROM storage.objects 
    WHERE bucket_id = 'avatars' AND (storage.foldername(name))[1] = user_id;
    
    -- Delete banner
    DELETE FROM storage.objects 
    WHERE bucket_id = 'banners' AND (storage.foldername(name))[1] = user_id;
    
    -- Delete mixes
    DELETE FROM storage.objects 
    WHERE bucket_id = 'mixes' AND (storage.foldername(name))[1] = user_id;
    
    -- Delete artwork
    DELETE FROM storage.objects 
    WHERE bucket_id = 'artwork' AND (storage.foldername(name))[1] = user_id;
    
    -- Delete buzz media
    DELETE FROM storage.objects 
    WHERE bucket_id = 'buzz-media' AND (storage.foldername(name))[1] = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get storage usage for a user
CREATE OR REPLACE FUNCTION get_user_storage_usage(user_id TEXT) RETURNS TABLE(
    bucket_name TEXT,
    file_count INTEGER,
    total_size BIGINT,
    average_size BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_files AS (
        SELECT 
            bucket_id,
            COUNT(*) as file_count,
            SUM(size) as total_size
        FROM storage.objects
        WHERE (storage.foldername(name))[1] = user_id
        GROUP BY bucket_id
    )
    SELECT 
        bucket_id,
        file_count,
        total_size,
        CASE WHEN file_count > 0 THEN total_size / file_count ELSE 0 END as average_size
    FROM user_files
    ORDER BY bucket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;