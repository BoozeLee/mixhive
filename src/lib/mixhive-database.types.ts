export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          banner_url: string | null;
          website_url: string | null;
          spotify_url: string | null;
          soundcloud_url: string | null;
          instagram_url: string | null;
          twitter_url: string | null;
          youtube_url: string | null;
          genres: string[] | null;
          location: string | null;
          is_verified: boolean;
          is_featured: boolean;
          follower_count: number;
          following_count: number;
          mix_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          display_name: string;
          bio?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          website_url?: string | null;
          spotify_url?: string | null;
          soundcloud_url?: string | null;
          instagram_url?: string | null;
          twitter_url?: string | null;
          youtube_url?: string | null;
          genres?: string[] | null;
          location?: string | null;
          is_verified?: boolean;
          is_featured?: boolean;
          follower_count?: number;
          following_count?: number;
          mix_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          website_url?: string | null;
          spotify_url?: string | null;
          soundcloud_url?: string | null;
          instagram_url?: string | null;
          twitter_url?: string | null;
          youtube_url?: string | null;
          genres?: string[] | null;
          location?: string | null;
          is_verified?: boolean;
          is_featured?: boolean;
          follower_count?: number;
          following_count?: number;
          mix_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      mixes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          genre: string;
          subgenre: string | null;
          bpm: number | null;
          key: string | null;
          duration: number | null;
          file_size: number | null;
          file_url: string;
          artwork_url: string | null;
          artwork_public_id: string | null;
          is_private: boolean;
          is_featured: boolean;
          play_count: number;
          like_count: number;
          download_count: number;
          comment_count: number;
          share_count: number;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          genre: string;
          subgenre?: string | null;
          bpm?: number | null;
          key?: string | null;
          duration?: number | null;
          file_size?: number | null;
          file_url: string;
          artwork_url?: string | null;
          artwork_public_id?: string | null;
          is_private?: boolean;
          is_featured?: boolean;
          play_count?: number;
          like_count?: number;
          download_count?: number;
          comment_count?: number;
          share_count?: number;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          genre?: string;
          subgenre?: string | null;
          bpm?: number | null;
          key?: string | null;
          duration?: number | null;
          file_size?: number | null;
          file_url?: string;
          artwork_url?: string | null;
          artwork_public_id?: string | null;
          is_private?: boolean;
          is_featured?: boolean;
          play_count?: number;
          like_count?: number;
          download_count?: number;
          comment_count?: number;
          share_count?: number;
          tags?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      buzz_posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          media_url: string | null;
          media_type: 'image' | 'video' | 'none' | null;
          media_public_id: string | null;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          is_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          media_url?: string | null;
          media_type?: 'image' | 'video' | 'none' | null;
          media_public_id?: string | null;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          media_url?: string | null;
          media_type?: 'image' | 'video' | 'none' | null;
          media_public_id?: string | null;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          is_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          mix_id: string | null;
          buzz_post_id: string | null;
          parent_id: string | null;
          content: string;
          likes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mix_id?: string | null;
          buzz_post_id?: string | null;
          parent_id?: string | null;
          content: string;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mix_id?: string | null;
          buzz_post_id?: string | null;
          parent_id?: string | null;
          content?: string;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      likes: {
        Row: {
          id: string;
          user_id: string;
          mix_id: string | null;
          buzz_post_id: string | null;
          comment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mix_id?: string | null;
          buzz_post_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mix_id?: string | null;
          buzz_post_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
        };
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
      };
      play_history: {
        Row: {
          id: string;
          user_id: string;
          mix_id: string;
          played_at: string;
          position: number;
          completed: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          mix_id: string;
          played_at?: string;
          position?: number;
          completed?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          mix_id?: string;
          played_at?: string;
          position?: number;
          completed?: boolean;
        };
      };
      downloads: {
        Row: {
          id: string;
          user_id: string;
          mix_id: string;
          downloaded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mix_id: string;
          downloaded_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mix_id?: string;
          downloaded_at?: string;
        };
      };
      playlists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          is_public: boolean;
          cover_url: string | null;
          track_count: number;
          play_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          is_public?: boolean;
          cover_url?: string | null;
          track_count?: number;
          play_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          is_public?: boolean;
          cover_url?: string | null;
          track_count?: number;
          play_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      playlist_mixes: {
        Row: {
          id: string;
          playlist_id: string;
          mix_id: string;
          position: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          mix_id: string;
          position?: number;
          added_at?: string;
        };
        Update: {
          id?: string;
          playlist_id?: string;
          mix_id?: string;
          position?: number;
          added_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          related_user_id: string | null;
          mix_id: string | null;
          buzz_post_id: string | null;
          comment_id: string | null;
          content: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          related_user_id?: string | null;
          mix_id?: string | null;
          buzz_post_id?: string | null;
          comment_id?: string | null;
          content: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          related_user_id?: string | null;
          mix_id?: string | null;
          buzz_post_id?: string | null;
          comment_id?: string | null;
          content?: string;
          is_read?: boolean;
          created_at?: string;
        };
      };
      search_history: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          search_type: string;
          results_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          search_type: string;
          results_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          query?: string;
          search_type?: string;
          results_count?: number;
          created_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          mix_id: string | null;
          buzz_post_id: string | null;
          comment_id: string | null;
          type: string;
          reason: string;
          status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          mix_id?: string | null;
          buzz_post_id?: string | null;
          comment_id?: string | null;
          type: string;
          reason: string;
          status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          mix_id?: string | null;
          buzz_post_id?: string | null;
          comment_id?: string | null;
          type?: string;
          reason?: string;
          status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
        };
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: string;
          event_data: Record<string, any> | null;
          user_agent: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_type: string;
          event_data?: Record<string, any> | null;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          event_type?: string;
          event_data?: Record<string, any> | null;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      user_profiles_with_counts: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          banner_url: string | null;
          website_url: string | null;
          spotify_url: string | null;
          soundcloud_url: string | null;
          instagram_url: string | null;
          twitter_url: string | null;
          youtube_url: string | null;
          genres: string[] | null;
          location: string | null;
          is_verified: boolean;
          is_featured: boolean;
          follower_count: number;
          following_count: number;
          mix_count: number;
          created_at: string;
          updated_at: string;
          mix_count_1: number;
          follower_count_1: number;
          following_count_1: number;
          playlist_count: number;
        };
      };
      popular_mixes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          genre: string;
          subgenre: string | null;
          bpm: number | null;
          key: string | null;
          duration: number | null;
          file_size: number | null;
          file_url: string;
          artwork_url: string | null;
          artwork_public_id: string | null;
          is_private: boolean;
          is_featured: boolean;
          play_count: number;
          like_count: number;
          download_count: number;
          comment_count: number;
          share_count: number;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
          display_name: string;
          username: string;
          avatar_url: string | null;
        };
      };
      trending_mixes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          genre: string;
          subgenre: string | null;
          bpm: number | null;
          key: string | null;
          duration: number | null;
          file_size: number | null;
          file_url: string;
          artwork_url: string | null;
          artwork_public_id: string | null;
          is_private: boolean;
          is_featured: boolean;
          play_count: number;
          like_count: number;
          download_count: number;
          comment_count: number;
          share_count: number;
          tags: string[] | null;
          created_at: string;
          updated_at: string;
          display_name: string;
          username: string;
          avatar_url: string | null;
          recent_plays: number;
        };
      };
    };
  };
}
