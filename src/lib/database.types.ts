export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_mixes: {
        Row: {
          cover_url: string
          created_at: string
          duration: number
          embed_html: string
          external_url: string
          genre: string
          id: number
          mix_type: string
          platform: string
          recorded_date: string
          slug: string
          tags: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string
          created_at?: string
          duration?: number
          embed_html?: string
          external_url: string
          genre?: string
          id?: number
          mix_type?: string
          platform: string
          recorded_date: string
          slug: string
          tags?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string
          created_at?: string
          duration?: number
          embed_html?: string
          external_url?: string
          genre?: string
          id?: number
          mix_type?: string
          platform?: string
          recorded_date?: string
          slug?: string
          tags?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          id: number
          password_hash: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: number
          password_hash: string
          username: string
        }
        Update: {
          created_at?: string
          id?: number
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          mix_id: string | null
          profile_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          mix_id?: string | null
          profile_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          mix_id?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string | null
          id: string
          mix_id: string
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          mix_id: string
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          mix_id?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          category: string
          cost_eur: number
          created_at: string | null
          id: number
          surface_m2: number
        }
        Insert: {
          category: string
          cost_eur: number
          created_at?: string | null
          id?: number
          surface_m2: number
        }
        Update: {
          category?: string
          cost_eur?: number
          created_at?: string | null
          id?: number
          surface_m2?: number
        }
        Relationships: []
      }
      feed_events: {
        Row: {
          actor_id: string
          created_at: string | null
          id: string
          mix_id: string | null
          target_id: string | null
          type: string
        }
        Insert: {
          actor_id: string
          created_at?: string | null
          id?: string
          mix_id?: string | null
          target_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string
          created_at?: string | null
          id?: string
          mix_id?: string | null
          target_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string | null
          mix_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          mix_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          mix_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mixes: {
        Row: {
          artwork_url: string | null
          audio_url: string
          comment_count: number | null
          created_at: string | null
          description: string | null
          dj_id: string
          duration_seconds: number | null
          genre_id: number | null
          id: string
          is_explicit: boolean | null
          like_count: number | null
          platform_links: Json | null
          play_count: number | null
          published: boolean | null
          tags: string[] | null
          title: string
          tracklist: Json | null
          updated_at: string | null
        }
        Insert: {
          artwork_url?: string | null
          audio_url: string
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          dj_id: string
          duration_seconds?: number | null
          genre_id?: number | null
          id?: string
          is_explicit?: boolean | null
          like_count?: number | null
          platform_links?: Json | null
          play_count?: number | null
          published?: boolean | null
          tags?: string[] | null
          title: string
          tracklist?: Json | null
          updated_at?: string | null
        }
        Update: {
          artwork_url?: string | null
          audio_url?: string
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          dj_id?: string
          duration_seconds?: number | null
          genre_id?: number | null
          id?: string
          is_explicit?: boolean | null
          like_count?: number | null
          platform_links?: Json | null
          play_count?: number | null
          published?: boolean | null
          tags?: string[] | null
          title?: string
          tracklist?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mixes_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mixes_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string | null
          data: Json | null
          id: string
          mix_id: string | null
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          mix_id?: string | null
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          mix_id?: string | null
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      play_history: {
        Row: {
          id: string
          mix_id: string
          played_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          mix_id: string
          played_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          mix_id?: string
          played_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "play_history_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_analytics_daily: {
        Row: {
          comments: number
          created_at: string
          day: string
          follows: number
          likes: number
          plays: number
          profile_id: string
          profile_views: number
          shares: number
          updated_at: string
        }
        Insert: {
          comments?: number
          created_at?: string
          day: string
          follows?: number
          likes?: number
          plays?: number
          profile_id: string
          profile_views?: number
          shares?: number
          updated_at?: string
        }
        Update: {
          comments?: number
          created_at?: string
          day?: string
          follows?: number
          likes?: number
          plays?: number
          profile_id?: string
          profile_views?: number
          shares?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_analytics_daily_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          genres: string[] | null
          id: string
          is_admin: boolean
          is_dj: boolean | null
          location: string | null
          social_links: Json | null
          updated_at: string | null
          username: string
          verified: boolean | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          genres?: string[] | null
          id: string
          is_admin?: boolean
          is_dj?: boolean | null
          location?: string | null
          social_links?: Json | null
          updated_at?: string | null
          username: string
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          genres?: string[] | null
          id?: string
          is_admin?: boolean
          is_dj?: boolean | null
          location?: string | null
          social_links?: Json | null
          updated_at?: string | null
          username?: string
          verified?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      radio_guests: {
        Row: {
          created_at: string
          date: string
          description: string
          id: number
          is_active: boolean
          name: string
          url: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string
          id?: number
          is_active?: boolean
          name: string
          url?: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string
          id?: number
          is_active?: boolean
          name?: string
          url?: string
        }
        Relationships: []
      }
      verification_badges: {
        Row: {
          badge_type: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          label: string
          profile_id: string
          reason: string | null
        }
        Insert: {
          badge_type: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          label: string
          profile_id: string
          reason?: string | null
        }
        Update: {
          badge_type?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          label?: string
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_badges_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          created_at: string
          dj_name: string
          id: string
          links: Json
          profile_id: string
          proof: string
          rejection_reason: string | null
          requested_badge: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dj_name: string
          id?: string
          links?: Json
          profile_id: string
          proof: string
          rejection_reason?: string | null
          requested_badge?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dj_name?: string
          id?: string
          links?: Json
          profile_id?: string
          proof?: string
          rejection_reason?: string | null
          requested_badge?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profile_analytics: {
        Row: {
          comments: number | null
          created_at: string | null
          day: string | null
          follows: number | null
          likes: number | null
          plays: number | null
          profile_id: string | null
          profile_views: number | null
          shares: number | null
          updated_at: string | null
        }
        Insert: {
          comments?: number | null
          created_at?: string | null
          day?: string | null
          follows?: number | null
          likes?: number | null
          plays?: number | null
          profile_id?: string | null
          profile_views?: number | null
          shares?: number | null
          updated_at?: string | null
        }
        Update: {
          comments?: number | null
          created_at?: string | null
          day?: string | null
          follows?: number | null
          likes?: number | null
          plays?: number | null
          profile_id?: string | null
          profile_views?: number | null
          shares?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_analytics_daily_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          artwork_url: string
          audio_url: string
          comment_count: number
          created_at: string
          dj_avatar_url: string
          dj_display_name: string
          dj_id: string
          dj_username: string
          duration_seconds: number
          genre_name: string
          id: string
          like_count: number
          play_count: number
          tags: string[]
          title: string
        }[]
      }
      get_trending: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          artwork_url: string
          audio_url: string
          comment_count: number
          created_at: string
          dj_avatar_url: string
          dj_display_name: string
          dj_id: string
          dj_username: string
          duration_seconds: number
          genre_name: string
          id: string
          like_count: number
          play_count: number
          tags: string[]
          title: string
          weekly_plays: number
        }[]
      }
      increment_play_count: { Args: { p_mix_id: string }; Returns: undefined }
      review_verification_request: {
        Args: {
          p_badge_type?: string
          p_reason?: string
          p_request_id: string
          p_reviewer_id: string
          p_status: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
