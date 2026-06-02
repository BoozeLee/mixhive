-- Create MixHive Database Schema
-- This migration creates all tables needed for the complete feature set

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Profiles Table (extends Supabase auth.users)
-- This table extends the default auth.users table with DJ-specific data
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    website_url TEXT,
    spotify_url TEXT,
    soundcloud_url TEXT,
    instagram_url TEXT,
    twitter_url TEXT,
    youtube_url TEXT,
    genres TEXT[], -- Array of genres the DJ works with
    location TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    mix_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$'),
    CONSTRAINT bio_length CHECK (CHAR_LENGTH(bio) <= 1000)
);

-- 2. Mixes Table
CREATE TABLE IF NOT EXISTS mixes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT NOT NULL,
    subgenre TEXT,
    bpm INTEGER,
    key TEXT,
    duration INTEGER, -- in seconds
    file_size BIGINT, -- in bytes
    file_url TEXT NOT NULL,
    artwork_url TEXT,
    artwork_public_id TEXT, -- for Cloudinary integration
    is_private BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    play_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_mixes_user_id (user_id),
    INDEX idx_mixes_genre (genre),
    INDEX idx_mixes_created_at (created_at),
    INDEX idx_mixes_play_count (play_count DESC),
    INDEX idx_mixes_featured (is_featured)
);

-- 3. Buzz Posts Table
CREATE TABLE IF NOT EXISTS buzz_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT, -- image or video URL
    media_type TEXT, -- 'image', 'video', 'none'
    media_public_id TEXT, -- for Cloudinary integration
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_buzz_user_id (user_id),
    INDEX idx_buzz_created_at (created_at),
    INDEX idx_buzz_pinned (is_pinned)
);

-- 4. Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    mix_id UUID REFERENCES mixes(id) ON DELETE CASCADE,
    buzz_post_id UUID REFERENCES buzz_posts(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- for nested comments
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one of mix_id or buzz_post_id is set
    CHECK ((mix_id IS NOT NULL AND buzz_post_id IS NULL) OR 
           (mix_id IS NULL AND buzz_post_id IS NOT NULL)),
    
    -- Indexes
    INDEX idx_comments_user_id (user_id),
    INDEX idx_comments_mix_id (mix_id),
    INDEX idx_comments_buzz_post_id (buzz_post_id),
    INDEX idx_comments_parent_id (parent_id),
    INDEX idx_comments_created_at (created_at)
);

-- 5. Likes Table
CREATE TABLE IF NOT EXISTS likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    mix_id UUID REFERENCES mixes(id) ON DELETE CASCADE,
    buzz_post_id UUID REFERENCES buzz_posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one of mix_id, buzz_post_id, or comment_id is set
    CHECK (
        (mix_id IS NOT NULL AND buzz_post_id IS NULL AND comment_id IS NULL) OR
        (mix_id IS NULL AND buzz_post_id IS NOT NULL AND comment_id IS NULL) OR
        (mix_id IS NULL AND buzz_post_id IS NULL AND comment_id IS NOT NULL)
    ),
    
    -- Unique constraint to prevent duplicate likes
    UNIQUE(user_id, mix_id),
    UNIQUE(user_id, buzz_post_id),
    UNIQUE(user_id, comment_id),
    
    -- Indexes
    INDEX idx_likes_user_id (user_id),
    INDEX idx_likes_mix_id (mix_id),
    INDEX idx_likes_buzz_post_id (buzz_post_id),
    INDEX idx_likes_comment_id (comment_id)
);

-- 6. Follows Table
CREATE TABLE IF NOT EXISTS follows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent self-following
    CHECK (follower_id != following_id),
    
    -- Unique constraint to prevent duplicate follows
    UNIQUE(follower_id, following_id),
    
    -- Indexes
    INDEX idx_follows_follower_id (follower_id),
    INDEX idx_follows_following_id (following_id)
);

-- 7. Play History Table
CREATE TABLE IF NOT EXISTS play_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    mix_id UUID REFERENCES mixes(id) ON DELETE CASCADE NOT NULL,
    played_at TIMESTAMPTZ DEFAULT NOW(),
    position INTEGER DEFAULT 0, -- position in seconds when paused
    completed BOOLEAN DEFAULT FALSE,
    
    -- Indexes
    INDEX idx_play_history_user_id (user_id),
    INDEX idx_play_history_mix_id (mix_id),
    INDEX idx_play_history_played_at (played_at)
);

-- 8. Downloads Table
CREATE TABLE IF NOT EXISTS downloads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    mix_id UUID REFERENCES mixes(id) ON DELETE CASCADE NOT NULL,
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_downloads_user_id (user_id),
    INDEX idx_downloads_mix_id (mix_id),
    INDEX idx_downloads_downloaded_at (downloaded_at)
);

-- 9. Playlists Table
CREATE TABLE IF NOT EXISTS playlists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    cover_url TEXT,
    track_count INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_playlists_user_id (user_id),
    INDEX idx_playlists_public (is_public),
    INDEX idx_playlists_created_at (created_at)
);

-- 10. Playlist Mixes Table (junction table)
CREATE TABLE IF NOT EXISTS playlist_mixes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
    mix_id UUID REFERENCES mixes(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL, -- order in playlist
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate mixes in playlist
    UNIQUE(playlist_id, mix_id),
    
    -- Indexes
    INDEX idx_playlist_mixes_playlist_id (playlist_id),
    INDEX idx_playlist_mixes_mix_id (mix_id),
    INDEX idx_playlist_mixes_position (position)
);

-- 11. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'like', 'comment', 'follow', 'mention', 'mix_uploaded'
    related_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    mix_id UUID REFERENCES mixes(id) ON DELETE CASCADE,
    buzz_post_id UUID REFERENCES buzz_posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_notifications_user_id (user_id),
    INDEX idx_notifications_type (type),
    INDEX idx_notifications_is_read (is_read),
    INDEX idx_notifications_created_at (created_at)
);

-- 12. Search History Table
CREATE TABLE IF NOT EXISTS search_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL, -- 'mixes', 'djs', 'all'
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_search_history_user_id (user_id),
    INDEX idx_search_history_query (query),
    INDEX idx_search_history_created_at (created_at)
);

-- 13. Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    mix_id UUID REFERENCES mixes(id) ON DELETE CASCADE,
    buzz_post_id UUID REFERENCES buzz_posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'spam', 'harassment', 'copyright', 'inappropriate'
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved'
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_reports_reporter_id (reporter_id),
    INDEX idx_reports_type (type),
    INDEX idx_reports_status (status),
    INDEX idx_reports_created_at (created_at)
);

-- 14. Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'page_view', 'mix_play', 'like', 'share', 'search'
    event_data JSONB, -- Additional event data
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_analytics_event_type (event_type),
    INDEX idx_analytics_created_at (created_at),
    INDEX idx_analytics_user_id (user_id)
);

-- Create functions for updating counts automatically

-- Function to update mix counts
CREATE OR REPLACE FUNCTION update_mix_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE mixes 
        SET like_count = (SELECT COUNT(*) FROM likes WHERE mix_id = NEW.mix_id),
            comment_count = (SELECT COUNT(*) FROM comments WHERE mix_id = NEW.mix_id),
            share_count = (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'mix_share' AND event_data->>'mix_id' = NEW.mix_id::text)
        WHERE id = NEW.mix_id;
        
        UPDATE profiles 
        SET mix_count = (SELECT COUNT(*) FROM mixes WHERE user_id = NEW.user_id)
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update profile follower counts
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE profiles 
        SET follower_count = (SELECT COUNT(*) FROM follows WHERE following_id = NEW.following_id)
        WHERE id = NEW.following_id;
        
        UPDATE profiles 
        SET following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = NEW.follower_id)
        WHERE id = NEW.follower_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic count updates
CREATE TRIGGER update_mix_likes_count
    AFTER INSERT OR DELETE ON likes
    FOR EACH ROW
    EXECUTE FUNCTION update_mix_counts();

CREATE TRIGGER update_mix_comments_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW
    WHEN (NEW.mix_id IS NOT NULL OR OLD.mix_id IS NOT NULL)
    EXECUTE FUNCTION update_mix_counts();

CREATE TRIGGER update_follower_counts_trigger
    AFTER INSERT OR DELETE ON follows
    FOR EACH ROW
    EXECUTE FUNCTION update_follower_counts();

-- Create row level security policies for all tables

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- RLS for mixes
ALTER TABLE mixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all mixes" ON mixes
    FOR SELECT USING (true);

CREATE POLICY "Users can create mix" ON mixes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mix" ON mixes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mix" ON mixes
    FOR DELETE USING (auth.uid() = user_id);

-- RLS for buzz_posts
ALTER TABLE buzz_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all posts" ON buzz_posts
    FOR SELECT USING (true);

CREATE POLICY "Users can create post" ON buzz_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own post" ON buzz_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own post" ON buzz_posts
    FOR DELETE USING (auth.uid() = user_id);

-- RLS for comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all comments" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create comment" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comment" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comment" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- RLS for likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all likes" ON likes
    FOR SELECT USING (true);

CREATE POLICY "Users can create like" ON likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own like" ON likes
    FOR DELETE USING (auth.uid() = user_id);

-- RLS for follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all follows" ON follows
    FOR SELECT USING (true);

CREATE POLICY "Users can follow" ON follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON follows
    FOR DELETE USING (auth.uid() = follower_id);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- RLS for playlists
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all playlists" ON playlists
    FOR SELECT USING (true);

CREATE POLICY "Users can create playlist" ON playlists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playlist" ON playlists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own playlist" ON playlists
    FOR DELETE USING (auth.uid() = user_id);

-- RLS for playlist_mixes
ALTER TABLE playlist_mixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all playlist mixes" ON playlist_mixes
    FOR SELECT USING (true);

CREATE POLICY "Users can add to playlist" ON playlist_mixes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM playlists WHERE id = NEW.playlist_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can remove from playlist" ON playlist_mixes
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM playlists WHERE id = playlist_id AND user_id = auth.uid())
    );

-- RLS for search_history
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search history" ON search_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create search history" ON search_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON reports
    FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create report" ON reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- RLS for analytics_events
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics" ON analytics_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create analytics" ON analytics_events
    FOR INSERT WITH CHECK (true);

-- Create views for common queries

-- View for user profiles with counts
CREATE OR REPLACE VIEW user_profiles_with_counts AS
SELECT 
    p.*,
    (SELECT COUNT(*) FROM mixes WHERE user_id = p.id) as mix_count,
    (SELECT COUNT(*) FROM follows WHERE following_id = p.id) as follower_count,
    (SELECT COUNT(*) FROM follows WHERE follower_id = p.id) as following_count,
    (SELECT COUNT(*) FROM playlists WHERE user_id = p.id) as playlist_count
FROM profiles p;

-- View for popular mixes
CREATE OR REPLACE VIEW popular_mixes AS
SELECT 
    m.*,
    p.display_name,
    p.username,
    p.avatar_url
FROM mixes m
JOIN profiles p ON m.user_id = p.id
WHERE m.is_private = false
ORDER BY m.play_count DESC, m.created_at DESC;

-- View for trending mixes
CREATE OR REPLACE VIEW trending_mixes AS
SELECT 
    m.*,
    p.display_name,
    p.username,
    p.avatar_url,
    COUNT(ph.id) as recent_plays
FROM mixes m
JOIN profiles p ON m.user_id = p.id
LEFT JOIN play_history ph ON m.id = ph.mix_id 
    AND ph.played_at >= NOW() - INTERVAL '7 days'
WHERE m.is_private = false
GROUP BY m.id, p.display_name, p.username, p.avatar_url
ORDER BY recent_plays DESC, m.play_count DESC
LIMIT 100;