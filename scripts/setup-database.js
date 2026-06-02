#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.blue('🗄️ Setting up MixHive database...'));

// Check if we have Supabase CLI installed
try {
  execSync('supabase --version', { stdio: 'ignore' });
  console.log(chalk.green('✅ Supabase CLI found'));
} catch (error) {
  console.log(chalk.red('❌ Supabase CLI not found'));
  console.log(chalk.yellow('💡 Install with: npm install -g supabase'));
  process.exit(1);
}

// Check if migrations exist
const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  console.log(chalk.yellow('⚠️  Migrations directory not found'));
  console.log(chalk.yellow('💡 Creating migrations directory...'));

  // Create migrations directory
  fs.mkdirSync(migrationsDir, { recursive: true });

  // Create initial migration
  const initialMigration = `
-- Create initial MixHive database schema
-- Generated on ${new Date().toISOString()}

-- Users table (inherits from auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}',
  genres TEXT[] DEFAULT '{}',
  country TEXT,
  city TEXT,
  stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mixes table
CREATE TABLE IF NOT EXISTS mixes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER,
  bpm INTEGER,
  key TEXT,
  genre TEXT,
  mood TEXT,
  tags TEXT[] DEFAULT '{}',
  artwork_url TEXT,
  audio_url TEXT,
  waveform_url TEXT,
  file_size INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  plays_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buzz Posts table
CREATE TABLE IF NOT EXISTS buzz_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio')),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID,
  target_type TEXT CHECK (target_type IN ('mix', 'buzz')),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id),
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Interactions table
CREATE TABLE IF NOT EXISTS social_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID,
  target_type TEXT CHECK (target_type IN ('mix', 'profile', 'buzz', 'comment')),
  interaction_type TEXT CHECK (interaction_type IN ('like', 'share', 'follow')),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mix Plays table
CREATE TABLE IF NOT EXISTS mix_plays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mix_id UUID REFERENCES mixes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  duration INTEGER,
  completion_percentage NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT,
  event_type TEXT,
  event_data JSONB,
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CDN Analytics table
CREATE TABLE IF NOT EXISTS cdn_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT CHECK (type IN ('image', 'video', 'audio', 'document')),
  operation TEXT CHECK (operation IN ('serve', 'optimize', 'cache_hit', 'cache_miss')),
  size INTEGER,
  duration INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search History table
CREATE TABLE IF NOT EXISTS search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  query TEXT,
  search_type TEXT CHECK (search_type IN ('mixes', 'profiles', 'all')),
  results_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mixes_user_id ON mixes(user_id);
CREATE INDEX IF NOT EXISTS idx_mixes_status ON mixes(status);
CREATE INDEX IF NOT EXISTS idx_mixes_created_at ON mixes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buzz_posts_user_id ON buzz_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_social_interactions_user_id ON social_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_social_interactions_target ON social_interactions(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cdn_analytics_created_at ON cdn_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC);

-- Create storage buckets
CREATE STORAGE LOCATION IF NOT EXISTS avatars;
CREATE STORAGE LOCATION IF NOT EXISTS banners;
CREATE STORAGE LOCATION IF NOT EXISTS mixes;
CREATE STORAGE LOCATION IF NOT EXISTS artwork;

-- Set up RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buzz_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdn_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles: Users can view their own profile and public profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles" ON profiles
  FOR SELECT USING (auth.uid() = id OR status = 'public');

-- Mixes: Users can view published mixes and their own mixes
CREATE POLICY "Users can view published mixes" ON mixes
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users can view own mixes" ON mixes
  FOR SELECT USING (auth.uid() = user_id);

-- Buzz: Users can view their own buzz and public buzz
CREATE POLICY "Users can view own buzz" ON buzz_posts
  FOR SELECT USING (auth.uid() = user_id);

-- Comments: Users can view their own comments
CREATE POLICY "Users can view own comments" ON comments
  FOR SELECT USING (auth.uid() = user_id);

-- Analytics: Users can view their own analytics
CREATE POLICY "Users can view own analytics" ON analytics_events
  FOR SELECT USING (auth.uid() = user_id);

-- Search: Users can view their own search history
CREATE POLICY "Users can view own search history" ON search_history
  FOR SELECT USING (auth.uid() = user_id);

-- Add trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_mixes_updated_at
  BEFORE UPDATE ON mixes
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_buzz_posts_updated_at
  BEFORE UPDATE ON buzz_posts
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER handle_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Grant permissions
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON mixes TO authenticated;
GRANT ALL ON buzz_posts TO authenticated;
GRANT ALL ON comments TO authenticated;
GRANT ALL ON social_interactions TO authenticated;
GRANT ALL ON analytics_events TO authenticated;
GRANT ALL ON mix_plays TO authenticated;
GRANT ALL ON cdn_analytics TO authenticated;
GRANT ALL ON search_history TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create views for popular content
CREATE OR REPLACE VIEW popular_mixes AS
SELECT m.*, p.username, p.avatar_url
FROM mixes m
JOIN profiles p ON m.user_id = p.id
WHERE m.status = 'published'
ORDER BY m.plays_count DESC, m.created_at DESC
LIMIT 50;

CREATE OR REPLACE VIEW trending_mixes AS
SELECT m.*, p.username, p.avatar_url
FROM mixes m
JOIN profiles p ON m.user_id = p.id
WHERE m.status = 'published'
AND m.created_at >= NOW() - INTERVAL '7 days'
ORDER BY m.plays_count DESC, m.created_at DESC
LIMIT 50;

-- Create function to get trending mixes
CREATE OR REPLACE FUNCTION get_trending(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID,
  title TEXT,
  username TEXT,
  avatar_url TEXT,
  plays_count INTEGER,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.title, p.username, p.avatar_url, m.plays_count, m.created_at
  FROM mixes m
  JOIN profiles p ON m.user_id = p.id
  WHERE m.status = 'published'
  AND m.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY m.plays_count DESC, m.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get popular mixes
CREATE OR REPLACE FUNCTION get_popular_mixes(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID,
  title TEXT,
  username TEXT,
  avatar_url TEXT,
  plays_count INTEGER,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.title, p.username, p.avatar_url, m.plays_count, m.created_at
  FROM mixes m
  JOIN profiles p ON m.user_id = p.id
  WHERE m.status = 'published'
  ORDER BY m.plays_count DESC, m.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user analytics
CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id UUID, p_days INT DEFAULT 30)
RETURNS TABLE (
  event_type TEXT,
  count INTEGER,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT event_type, COUNT(*), created_at
  FROM analytics_events
  WHERE user_id = p_user_id
  AND created_at >= NOW() - INTERVAL p_days || ' days'
  GROUP BY event_type, created_at
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get mix analytics
CREATE OR REPLACE FUNCTION get_mix_analytics(p_mix_id UUID, p_days INT DEFAULT 30)
RETURNS TABLE (
  user_id UUID,
  duration INTEGER,
  completion_percentage NUMERIC,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT user_id, duration, completion_percentage, created_at
  FROM mix_plays
  WHERE mix_id = p_mix_id
  AND created_at >= NOW() - INTERVAL p_days || ' days'
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON SCHEMA public IS 'MixHive production schema';

-- Final setup confirmation
SELECT 'MixHive database setup completed successfully' AS status;
`;

  fs.writeFileSync(path.join(migrationsDir, '001_initial_setup.sql'), initialMigration);
  console.log(chalk.green('✅ Created initial migration file'));
}

// Initialize Supabase project
console.log(chalk.blue('\n🚀 Initializing Supabase project...'));

try {
  // Check if we're already initialized
  const projectExists = fs.existsSync(path.join(process.cwd(), 'supabase', 'config'));

  if (projectExists) {
    console.log(chalk.green('✅ Supabase project already initialized'));
  } else {
    // Initialize new project
    execSync('supabase init --project-name mixhive-prod', { stdio: 'inherit' });
    console.log(chalk.green('✅ Supabase project initialized'));
  }

  // Login to Supabase (if needed)
  console.log(chalk.blue('🔐 Checking Supabase authentication...'));

  try {
    execSync('supabase login', { stdio: 'ignore' });
    console.log(chalk.green('✅ Already authenticated with Supabase'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Not authenticated with Supabase'));
    console.log(chalk.yellow('💡 Please run: supabase login'));
    console.log(chalk.yellow('   Then run this script again'));
    process.exit(1);
  }

  // Push migrations
  console.log(chalk.blue('\n📤 Pushing database migrations...'));
  execSync('supabase db push', { stdio: 'inherit' });
  console.log(chalk.green('✅ Database migrations pushed successfully'));

  // Create storage buckets
  console.log(chalk.blue('\n📦 Creating storage buckets...'));

  const buckets = ['avatars', 'banners', 'mixes', 'artwork'];
  buckets.forEach(bucket => {
    try {
      execSync(`supabase storage create ${bucket}`, { stdio: 'ignore' });
      console.log(chalk.green(`✅ Storage bucket created: ${bucket}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Bucket may already exist: ${bucket}`));
    }
  });

  // Set up storage policies
  console.log(chalk.blue('\n🔒 Setting up storage policies...'));

  const policies = [
    {
      bucket: 'avatars',
      policy: `CREATE POLICY "Authenticated users can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');`,
    },
    {
      bucket: 'banners',
      policy: `CREATE POLICY "Authenticated users can view banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');`,
    },
    {
      bucket: 'mixes',
      policy: `CREATE POLICY "Authenticated users can view mixes" ON storage.objects FOR SELECT USING (bucket_id = 'mixes');`,
    },
    {
      bucket: 'artwork',
      policy: `CREATE POLICY "Authenticated users can view artwork" ON storage.objects FOR SELECT USING (bucket_id = 'artwork');`,
    },
  ];

  policies.forEach(({ bucket, policy }) => {
    try {
      execSync(`supabase db rpc -q "${policy}"`, { stdio: 'ignore' });
      console.log(chalk.green(`✅ Storage policy created for: ${bucket}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Policy may already exist for: ${bucket}`));
    }
  });

  console.log(chalk.green('\n🎉 Database setup completed successfully!'));
  console.log(chalk.blue('\n📋 Next steps:'));
  console.log(chalk.yellow('1. Set up Supabase environment variables in .env.production'));
  console.log(chalk.yellow('2. Configure CDN (Cloudflare or AWS CloudFront)'));
  console.log(chalk.yellow('3. Set up analytics and monitoring'));
  console.log(chalk.yellow('4. Deploy to production'));
} catch (error) {
  console.log(chalk.red('\n❌ Database setup failed:'));
  console.log(chalk.red(error.message));
  console.log(chalk.yellow('\n💡 Troubleshooting steps:'));
  console.log(chalk.yellow('1. Ensure Supabase CLI is installed and authenticated'));
  console.log(chalk.yellow('2. Check your internet connection'));
  console.log(chalk.yellow('3. Verify Supabase project permissions'));
  process.exit(1);
}
