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
      agent_kv: {
        Row: {
          agent_id: string
          expires_at: string | null
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          agent_id: string
          expires_at?: string | null
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          agent_id?: string
          expires_at?: string | null
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_kv_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "lua_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_registry: {
        Row: {
          approval_policy: string
          created_at: string
          description: string | null
          display_name: string
          enabled: boolean
          id: string
          lua_script: string
          lua_script_version: number
          max_tokens_per_run: number
          tier: string
          timeout_ms: number
          tools_whitelist: string[]
          updated_at: string
        }
        Insert: {
          approval_policy?: string
          created_at?: string
          description?: string | null
          display_name: string
          enabled?: boolean
          id: string
          lua_script: string
          lua_script_version?: number
          max_tokens_per_run?: number
          tier?: string
          timeout_ms?: number
          tools_whitelist?: string[]
          updated_at?: string
        }
        Update: {
          approval_policy?: string
          created_at?: string
          description?: string | null
          display_name?: string
          enabled?: boolean
          id?: string
          lua_script?: string
          lua_script_version?: number
          max_tokens_per_run?: number
          tier?: string
          timeout_ms?: number
          tools_whitelist?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_id: string
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          profile_id: string
          status: string
          tokens_used: number
          trigger: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          profile_id: string
          status: string
          tokens_used?: number
          trigger?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          profile_id?: string
          status?: string
          tokens_used?: number
          trigger?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_embeddings: {
        Row: {
          created_at: string
          embedding: string | null
          entity_id: string | null
          entity_key: string | null
          entity_type: string
          id: string
          metadata: Json
          model: string
          owner_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          entity_id?: string | null
          entity_key?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          model?: string
          owner_id?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          embedding?: string | null
          entity_id?: string | null
          entity_key?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          model?: string
          owner_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_embeddings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          outcome: string | null
          owner_id: string
          rating: number | null
          suggestion_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          owner_id: string
          rating?: number | null
          suggestion_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          owner_id?: string
          rating?: number | null
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_suggestions: {
        Row: {
          applied_at: string | null
          confidence: number | null
          created_at: string
          id: string
          model: string | null
          owner_id: string
          payload: Json
          rationale: string | null
          rejected_at: string | null
          source: string
          status: string
          suggestion_type: string
          version: number
        }
        Insert: {
          applied_at?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          owner_id: string
          payload?: Json
          rationale?: string | null
          rejected_at?: string | null
          source?: string
          status?: string
          suggestion_type: string
          version?: number
        }
        Update: {
          applied_at?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          owner_id?: string
          payload?: Json
          rationale?: string | null
          rejected_at?: string | null
          source?: string
          status?: string
          suggestion_type?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      artist_goals: {
        Row: {
          base_city: string | null
          booking_open: boolean
          goals: string[]
          skills: string[]
          travel_radius_km: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_city?: string | null
          booking_open?: boolean
          goals?: string[]
          skills?: string[]
          travel_radius_km?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_city?: string | null
          booking_open?: boolean
          goals?: string[]
          skills?: string[]
          travel_radius_km?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_features: {
        Row: {
          bpm: number | null
          camelot: string | null
          confidence: number | null
          created_at: string
          danceability: number | null
          energy: number | null
          error_message: string | null
          id: string
          mix_id: string
          model: string | null
          mood: string | null
          musical_key: string | null
          source: string
          status: string
          structure_json: Json
          updated_at: string
        }
        Insert: {
          bpm?: number | null
          camelot?: string | null
          confidence?: number | null
          created_at?: string
          danceability?: number | null
          energy?: number | null
          error_message?: string | null
          id?: string
          mix_id: string
          model?: string | null
          mood?: string | null
          musical_key?: string | null
          source?: string
          status?: string
          structure_json?: Json
          updated_at?: string
        }
        Update: {
          bpm?: number | null
          camelot?: string | null
          confidence?: number | null
          created_at?: string
          danceability?: number | null
          energy?: number | null
          error_message?: string | null
          id?: string
          mix_id?: string
          model?: string | null
          mood?: string | null
          musical_key?: string | null
          source?: string
          status?: string
          structure_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_features_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: true
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          max_retries: number
          mix_id: string
          result: Json | null
          retry_count: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          max_retries?: number
          mix_id: string
          result?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          max_retries?: number
          mix_id?: string
          result?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_jobs_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
        ]
      }
      buzz_likes: {
        Row: {
          buzz_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          buzz_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          buzz_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buzz_likes_buzz_id_fkey"
            columns: ["buzz_id"]
            isOneToOne: false
            referencedRelation: "buzzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buzz_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buzz_reposts: {
        Row: {
          buzz_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          buzz_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          buzz_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buzz_reposts_buzz_id_fkey"
            columns: ["buzz_id"]
            isOneToOne: false
            referencedRelation: "buzzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buzz_reposts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buzzes: {
        Row: {
          attached_mix_id: string | null
          audio_url: string | null
          author_id: string
          body: string
          code_language: string | null
          code_snippet: string | null
          created_at: string
          id: string
          image_url: string | null
          is_repost: boolean
          like_count: number
          moderation_reason: string | null
          moderation_status: string | null
          original_buzz_id: string | null
          parent_buzz_id: string | null
          reply_count: number
          repost_count: number
          updated_at: string
          video_url: string | null
        }
        Insert: {
          attached_mix_id?: string | null
          audio_url?: string | null
          author_id: string
          body: string
          code_language?: string | null
          code_snippet?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_repost?: boolean
          like_count?: number
          moderation_reason?: string | null
          moderation_status?: string | null
          original_buzz_id?: string | null
          parent_buzz_id?: string | null
          reply_count?: number
          repost_count?: number
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          attached_mix_id?: string | null
          audio_url?: string | null
          author_id?: string
          body?: string
          code_language?: string | null
          code_snippet?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_repost?: boolean
          like_count?: number
          moderation_reason?: string | null
          moderation_status?: string | null
          original_buzz_id?: string | null
          parent_buzz_id?: string | null
          reply_count?: number
          repost_count?: number
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buzzes_attached_mix_id_fkey"
            columns: ["attached_mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buzzes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buzzes_original_buzz_id_fkey"
            columns: ["original_buzz_id"]
            isOneToOne: false
            referencedRelation: "buzzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buzzes_parent_buzz_id_fkey"
            columns: ["parent_buzz_id"]
            isOneToOne: false
            referencedRelation: "buzzes"
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
          moderation_reason: string | null
          moderation_status: string | null
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          mix_id: string
          moderation_reason?: string | null
          moderation_status?: string | null
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          mix_id?: string
          moderation_reason?: string | null
          moderation_status?: string | null
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
      creator_tasks: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          owner_id: string
          priority: number
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          owner_id: string
          priority?: number
          status?: string
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          owner_id?: string
          priority?: number
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_tasks_owner_id_fkey"
            columns: ["owner_id"]
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
          buzz_id: string | null
          created_at: string | null
          id: string
          mix_id: string | null
          target_id: string | null
          type: string
        }
        Insert: {
          actor_id: string
          buzz_id?: string | null
          created_at?: string | null
          id?: string
          mix_id?: string | null
          target_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string
          buzz_id?: string | null
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
            foreignKeyName: "feed_events_buzz_id_fkey"
            columns: ["buzz_id"]
            isOneToOne: false
            referencedRelation: "buzzes"
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
      lua_agent_runs: {
        Row: {
          agent_id: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event_payload: Json | null
          id: number
          status: string
          stdout: string | null
          triggered_by: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_payload?: Json | null
          id?: never
          status: string
          stdout?: string | null
          triggered_by: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_payload?: Json | null
          id?: never
          status?: string
          stdout?: string | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "lua_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "lua_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      lua_agents: {
        Row: {
          consecutive_error_count: number
          created_at: string
          cron_expr: string | null
          description: string | null
          enabled: boolean
          error_count: number
          fork_count: number
          fork_of: string | null
          id: string
          is_public: boolean
          last_error: string | null
          last_run_at: string | null
          lua_code: string
          memory_kb: number
          name: string
          owner_id: string
          run_count: number
          timeout_ms: number
          trigger_type: string | null
          updated_at: string
        }
        Insert: {
          consecutive_error_count?: number
          created_at?: string
          cron_expr?: string | null
          description?: string | null
          enabled?: boolean
          error_count?: number
          fork_count?: number
          fork_of?: string | null
          id?: string
          is_public?: boolean
          last_error?: string | null
          last_run_at?: string | null
          lua_code: string
          memory_kb?: number
          name: string
          owner_id: string
          run_count?: number
          timeout_ms?: number
          trigger_type?: string | null
          updated_at?: string
        }
        Update: {
          consecutive_error_count?: number
          created_at?: string
          cron_expr?: string | null
          description?: string | null
          enabled?: boolean
          error_count?: number
          fork_count?: number
          fork_of?: string | null
          id?: string
          is_public?: boolean
          last_error?: string | null
          last_run_at?: string | null
          lua_code?: string
          memory_kb?: number
          name?: string
          owner_id?: string
          run_count?: number
          timeout_ms?: number
          trigger_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lua_agents_fork_of_fkey"
            columns: ["fork_of"]
            isOneToOne: false
            referencedRelation: "lua_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lua_agents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mix_tracks: {
        Row: {
          artist: string | null
          confidence: number | null
          created_at: string
          end_sec: number | null
          id: string
          label: string | null
          mix_id: string
          source: string
          start_sec: number
          title: string | null
        }
        Insert: {
          artist?: string | null
          confidence?: number | null
          created_at?: string
          end_sec?: number | null
          id?: string
          label?: string | null
          mix_id: string
          source?: string
          start_sec?: number
          title?: string | null
        }
        Update: {
          artist?: string | null
          confidence?: number | null
          created_at?: string
          end_sec?: number | null
          id?: string
          label?: string | null
          mix_id?: string
          source?: string
          start_sec?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mix_tracks_mix_id_fkey"
            columns: ["mix_id"]
            isOneToOne: false
            referencedRelation: "mixes"
            referencedColumns: ["id"]
          },
        ]
      }
      mixes: {
        Row: {
          artwork_url: string | null
          audio_metadata: Json | null
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
          moderation_reason: string | null
          moderation_status: string | null
          platform_links: Json | null
          play_count: number | null
          processed_at: string | null
          processing_errors: Json | null
          processing_started_at: string | null
          published: boolean | null
          tags: string[] | null
          title: string
          tracklist: Json | null
          updated_at: string | null
          upload_status: string | null
          waveform_data: Json | null
          waveform_url: string | null
        }
        Insert: {
          artwork_url?: string | null
          audio_metadata?: Json | null
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
          moderation_reason?: string | null
          moderation_status?: string | null
          platform_links?: Json | null
          play_count?: number | null
          processed_at?: string | null
          processing_errors?: Json | null
          processing_started_at?: string | null
          published?: boolean | null
          tags?: string[] | null
          title: string
          tracklist?: Json | null
          updated_at?: string | null
          upload_status?: string | null
          waveform_data?: Json | null
          waveform_url?: string | null
        }
        Update: {
          artwork_url?: string | null
          audio_metadata?: Json | null
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
          moderation_reason?: string | null
          moderation_status?: string | null
          platform_links?: Json | null
          play_count?: number | null
          processed_at?: string | null
          processing_errors?: Json | null
          processing_started_at?: string | null
          published?: boolean | null
          tags?: string[] | null
          title?: string
          tracklist?: Json | null
          updated_at?: string | null
          upload_status?: string | null
          waveform_data?: Json | null
          waveform_url?: string | null
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
      moderation_signals: {
        Row: {
          action_taken: string | null
          created_at: string
          flagged_by: string
          id: string
          payload: Json
          severity: string
          signal_type: string
          source_id: string | null
          source_table: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          flagged_by?: string
          id?: string
          payload?: Json
          severity: string
          signal_type: string
          source_id?: string | null
          source_table: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          flagged_by?: string
          id?: string
          payload?: Json
          severity?: string
          signal_type?: string
          source_id?: string | null
          source_table?: string
        }
        Relationships: []
      }
      mythic_edges: {
        Row: {
          created_at: string
          edge_type: string
          from_node_id: string
          id: string
          metadata: Json
          occurred_at: string | null
          source_event: string | null
          to_node_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          edge_type: string
          from_node_id: string
          id?: string
          metadata?: Json
          occurred_at?: string | null
          source_event?: string | null
          to_node_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          edge_type?: string
          from_node_id?: string
          id?: string
          metadata?: Json
          occurred_at?: string | null
          source_event?: string | null
          to_node_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "mythic_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "mythic_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mythic_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "mythic_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      mythic_graph_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          max_retries: number
          result: Json | null
          retry_count: number
          scope: Json
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          max_retries?: number
          result?: Json | null
          retry_count?: number
          scope?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          max_retries?: number
          result?: Json | null
          retry_count?: number
          scope?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mythic_nodes: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          node_type: string
          occurred_at: string | null
          owner_id: string | null
          payload: Json
          source_id: string | null
          source_table: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          node_type: string
          occurred_at?: string | null
          owner_id?: string | null
          payload?: Json
          source_id?: string | null
          source_table?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          node_type?: string
          occurred_at?: string | null
          owner_id?: string | null
          payload?: Json
          source_id?: string | null
          source_table?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mythic_nodes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          buzz_id: string | null
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
          buzz_id?: string | null
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
          buzz_id?: string | null
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
            foreignKeyName: "notifications_buzz_id_fkey"
            columns: ["buzz_id"]
            isOneToOne: false
            referencedRelation: "buzzes"
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
      opportunities: {
        Row: {
          city: string | null
          compensation: string | null
          country: string
          created_at: string
          deadline: string | null
          description: string | null
          genres: string[]
          id: string
          is_active: boolean
          location: string | null
          opp_type: string
          organizer: string | null
          roles: string[]
          source: string
          source_url: string | null
          tags: string[]
          title: string
        }
        Insert: {
          city?: string | null
          compensation?: string | null
          country?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          genres?: string[]
          id?: string
          is_active?: boolean
          location?: string | null
          opp_type?: string
          organizer?: string | null
          roles?: string[]
          source?: string
          source_url?: string | null
          tags?: string[]
          title: string
        }
        Update: {
          city?: string | null
          compensation?: string | null
          country?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          genres?: string[]
          id?: string
          is_active?: boolean
          location?: string | null
          opp_type?: string
          organizer?: string | null
          roles?: string[]
          source?: string
          source_url?: string | null
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
      opportunity_saves: {
        Row: {
          created_at: string
          draft_text: string | null
          id: string
          opportunity_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_text?: string | null
          id?: string
          opportunity_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_text?: string | null
          id?: string
          opportunity_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_saves_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_saves_user_id_fkey"
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
      press_kits: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_public: boolean
          owner_id: string
          pdf_url: string | null
          public_slug: string
          title: string
          updated_at: string
          version: number
          view_count: number
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_public?: boolean
          owner_id: string
          pdf_url?: string | null
          public_slug: string
          title: string
          updated_at?: string
          version?: number
          view_count?: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_public?: boolean
          owner_id?: string
          pdf_url?: string | null
          public_slug?: string
          title?: string
          updated_at?: string
          version?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "press_kits_owner_id_fkey"
            columns: ["owner_id"]
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
          dj_daw: string[]
          dj_equipment: string[]
          dj_style: string | null
          genres: string[] | null
          id: string
          is_admin: boolean
          is_dj: boolean | null
          is_pro: boolean
          location: string | null
          moderation_reason: string | null
          moderation_status: string | null
          onboarding_complete: boolean
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
          dj_daw?: string[]
          dj_equipment?: string[]
          dj_style?: string | null
          genres?: string[] | null
          id: string
          is_admin?: boolean
          is_dj?: boolean | null
          is_pro?: boolean
          location?: string | null
          moderation_reason?: string | null
          moderation_status?: string | null
          onboarding_complete?: boolean
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
          dj_daw?: string[]
          dj_equipment?: string[]
          dj_style?: string | null
          genres?: string[] | null
          id?: string
          is_admin?: boolean
          is_dj?: boolean | null
          is_pro?: boolean
          location?: string | null
          moderation_reason?: string | null
          moderation_status?: string | null
          onboarding_complete?: boolean
          social_links?: Json | null
          updated_at?: string | null
          username?: string
          verified?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      quest_milestone_evidence: {
        Row: {
          created_at: string
          id: string
          milestone_id: string
          node_id: string
          quest_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_id: string
          node_id: string
          quest_id: string
        }
        Update: {
          created_at?: string
          id?: string
          milestone_id?: string
          node_id?: string
          quest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_milestone_evidence_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "quest_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_milestone_evidence_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "mythic_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_milestone_evidence_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_milestones: {
        Row: {
          completed_at: string | null
          completed_via_edge_id: string | null
          id: string
          quest_id: string
          sort_order: number
          status: string
          target_node_type: string | null
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_via_edge_id?: string | null
          id?: string
          quest_id: string
          sort_order?: number
          status?: string
          target_node_type?: string | null
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_via_edge_id?: string | null
          id?: string
          quest_id?: string
          sort_order?: number
          status?: string
          target_node_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_milestones_completed_via_edge_id_fkey"
            columns: ["completed_via_edge_id"]
            isOneToOne: false
            referencedRelation: "mythic_edges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_milestones_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          created_at: string
          created_by_agent_id: string | null
          description: string | null
          id: string
          momentum: number | null
          owner_id: string
          status: string
          target_scene_tags: string[]
          timeframe_days: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_agent_id?: string | null
          description?: string | null
          id?: string
          momentum?: number | null
          owner_id: string
          status?: string
          target_scene_tags?: string[]
          timeframe_days?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_agent_id?: string | null
          description?: string | null
          id?: string
          momentum?: number | null
          owner_id?: string
          status?: string
          target_scene_tags?: string[]
          timeframe_days?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quests_created_by_agent_id_fkey"
            columns: ["created_by_agent_id"]
            isOneToOne: false
            referencedRelation: "lua_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      recommendation_scores: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          model: string | null
          owner_id: string
          rationale: string | null
          score: number
          target_id: string | null
          target_key: string | null
          target_type: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          owner_id: string
          rationale?: string | null
          score?: number
          target_id?: string | null
          target_key?: string | null
          target_type: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          owner_id?: string
          rationale?: string | null
          score?: number
          target_id?: string | null
          target_key?: string | null
          target_type?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_scores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_keys: {
        Row: {
          created_at: string
          has_key: boolean | null
          openai_api_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          has_key?: boolean | null
          openai_api_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          has_key?: boolean | null
          openai_api_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_ai_key_status: {
        Row: {
          has_key: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          has_key?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          has_key?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      agent_kv_del: {
        Args: { p_agent_id: string; p_key: string }
        Returns: undefined
      }
      agent_kv_get: {
        Args: { p_agent_id: string; p_key: string }
        Returns: string
      }
      agent_kv_list: {
        Args: { p_agent_id: string }
        Returns: {
          expires_at: string
          key: string
          value: string
        }[]
      }
      agent_kv_set: {
        Args: {
          p_agent_id: string
          p_key: string
          p_ttl_seconds?: number
          p_value: string
        }
        Returns: undefined
      }
      cleanup_completed_audio_jobs: {
        Args: { p_days_to_keep?: number }
        Returns: number
      }
      cleanup_completed_mythic_graph_jobs: {
        Args: { p_days_to_keep?: number }
        Returns: number
      }
      derive_mix_node: { Args: { p_mix_id: string }; Returns: string }
      derive_opportunity_submission: {
        Args: { p_opportunity_id: string; p_status: string; p_user_id: string }
        Returns: undefined
      }
      enqueue_audio_job: {
        Args: { p_job_type?: string; p_max_retries?: number; p_mix_id: string }
        Returns: string
      }
      enqueue_mythic_graph_job: {
        Args: { p_job_type: string; p_max_retries?: number; p_scope: Json }
        Returns: string
      }
      ensure_unique_signup_username: {
        Args: { raw_username: string; user_id: string }
        Returns: string
      }
      find_similar_artists_by_graph_overlap: {
        Args: {
          p_days_window?: number
          p_limit?: number
          p_min_shared?: number
          p_user_id: string
        }
        Returns: {
          artist_node_id: string
          score: number
          shared_mix_engagement: number
          shared_venues: number
          total_shared_signals: number
        }[]
      }
      fork_lua_agent: {
        Args: { p_new_name?: string; p_source_id: string }
        Returns: string
      }
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
      get_similarity_reasons: {
        Args: { p_artist_a: string; p_artist_b: string; p_days_window?: number }
        Returns: Json
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
      increment_press_kit_view_count: {
        Args: { p_slug: string }
        Returns: undefined
      }
      mark_audio_job_complete: {
        Args: { p_job_id: string; p_result: Json }
        Returns: undefined
      }
      mark_audio_job_failed: {
        Args: {
          p_error_message: string
          p_job_id: string
          p_should_retry?: boolean
        }
        Returns: undefined
      }
      mark_audio_job_processing: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      mark_mythic_graph_job_complete: {
        Args: { p_job_id: string; p_result?: Json }
        Returns: undefined
      }
      mark_mythic_graph_job_failed: {
        Args: {
          p_error_message: string
          p_job_id: string
          p_should_retry?: boolean
        }
        Returns: undefined
      }
      mark_mythic_graph_job_processing: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      match_ai_embeddings: {
        Args: {
          filter_entity_type?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          entity_id: string
          entity_key: string
          entity_type: string
          id: string
          metadata: Json
          owner_id: string
          similarity: number
        }[]
      }
      normalize_signup_username: {
        Args: { raw_username: string; user_id: string }
        Returns: string
      }
      record_lua_agent_run: {
        Args: {
          p_agent_id: string
          p_duration_ms: number
          p_error_message: string
          p_event_payload: Json
          p_status: string
          p_stdout: string
          p_triggered_by: string
        }
        Returns: undefined
      }
      record_mythic_event: {
        Args: {
          p_node_type: string
          p_occurred_at?: string
          p_owner_id: string
          p_payload?: Json
          p_source_id: string
          p_source_table: string
          p_title?: string
        }
        Returns: string
      }
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
      trim_lua_agent_runs: { Args: { p_keep?: number }; Returns: undefined }
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
