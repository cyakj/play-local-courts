export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      amenity_rules: {
        Row: {
          advance_booking_days: number | null
          allow_ball_machine: boolean | null
          allow_guests: boolean | null
          amenity_id: string
          booking_end_time: string | null
          booking_start_time: string | null
          checkin_required_minutes: number | null
          created_at: string | null
          custom_rules: string | null
          doubles_only: boolean | null
          enable_peak_hours: boolean | null
          hoa_id: string
          id: string
          max_duration_minutes: number | null
          max_guest_count: number | null
          max_no_shows: number | null
          max_reservations_per_day: number | null
          max_reservations_per_week: number | null
          min_cancellation_hours: number | null
          min_time_between_reservations: number | null
          no_lifeguard_acknowledgment: boolean | null
          no_show_restriction_days: number | null
          peak_end_time: string | null
          peak_max_duration_minutes: number | null
          peak_start_time: string | null
          requires_admin_approval: boolean | null
          requires_cleanup_agreement: boolean | null
          requires_power_outlet: boolean | null
          security_deposit_amount: number | null
          security_deposit_required: boolean | null
          singles_only: boolean | null
          updated_at: string | null
        }
        Insert: {
          advance_booking_days?: number | null
          allow_ball_machine?: boolean | null
          allow_guests?: boolean | null
          amenity_id: string
          booking_end_time?: string | null
          booking_start_time?: string | null
          checkin_required_minutes?: number | null
          created_at?: string | null
          custom_rules?: string | null
          doubles_only?: boolean | null
          enable_peak_hours?: boolean | null
          hoa_id: string
          id?: string
          max_duration_minutes?: number | null
          max_guest_count?: number | null
          max_no_shows?: number | null
          max_reservations_per_day?: number | null
          max_reservations_per_week?: number | null
          min_cancellation_hours?: number | null
          min_time_between_reservations?: number | null
          no_lifeguard_acknowledgment?: boolean | null
          no_show_restriction_days?: number | null
          peak_end_time?: string | null
          peak_max_duration_minutes?: number | null
          peak_start_time?: string | null
          requires_admin_approval?: boolean | null
          requires_cleanup_agreement?: boolean | null
          requires_power_outlet?: boolean | null
          security_deposit_amount?: number | null
          security_deposit_required?: boolean | null
          singles_only?: boolean | null
          updated_at?: string | null
        }
        Update: {
          advance_booking_days?: number | null
          allow_ball_machine?: boolean | null
          allow_guests?: boolean | null
          amenity_id?: string
          booking_end_time?: string | null
          booking_start_time?: string | null
          checkin_required_minutes?: number | null
          created_at?: string | null
          custom_rules?: string | null
          doubles_only?: boolean | null
          enable_peak_hours?: boolean | null
          hoa_id?: string
          id?: string
          max_duration_minutes?: number | null
          max_guest_count?: number | null
          max_no_shows?: number | null
          max_reservations_per_day?: number | null
          max_reservations_per_week?: number | null
          min_cancellation_hours?: number | null
          min_time_between_reservations?: number | null
          no_lifeguard_acknowledgment?: boolean | null
          no_show_restriction_days?: number | null
          peak_end_time?: string | null
          peak_max_duration_minutes?: number | null
          peak_start_time?: string | null
          requires_admin_approval?: boolean | null
          requires_cleanup_agreement?: boolean | null
          requires_power_outlet?: boolean | null
          security_deposit_amount?: number | null
          security_deposit_required?: boolean | null
          singles_only?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amenity_rules_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_rules_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          court_id: string
          created_at: string | null
          date: string
          end_time: string
          id: string
          play_type: string | null
          start_time: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          court_id: string
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          play_type?: string | null
          start_time: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          court_id?: string
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          play_type?: string | null
          start_time?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          profile_id: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          profile_id?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          profile_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      court_maintenance: {
        Row: {
          court_id: string
          created_at: string | null
          date: string
          description: string | null
          end_time: string
          id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          court_id: string
          created_at?: string | null
          date: string
          description?: string | null
          end_time: string
          id?: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          court_id?: string
          created_at?: string | null
          date?: string
          description?: string | null
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_maintenance_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          court_type: string
          created_at: string | null
          hoa_id: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          court_type: string
          created_at?: string | null
          hoa_id: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          court_type?: string
          created_at?: string | null
          hoa_id?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courts_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          admin_announcements: boolean
          booking_confirmations: boolean
          booking_reminders: boolean
          cancellation_notifications: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_announcements?: boolean
          booking_confirmations?: boolean
          booking_reminders?: boolean
          cancellation_notifications?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_announcements?: boolean
          booking_confirmations?: boolean
          booking_reminders?: boolean
          cancellation_notifications?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hoas: {
        Row: {
          address: string | null
          admin_id: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          admin_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          admin_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      match_preferences: {
        Row: {
          created_at: string
          id: string
          looking_to_play: boolean
          match_types: string[]
          notes: string | null
          preferred_days: string[]
          preferred_times: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          looking_to_play?: boolean
          match_types?: string[]
          notes?: string | null
          preferred_days?: string[]
          preferred_times?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          looking_to_play?: boolean
          match_types?: string[]
          notes?: string | null
          preferred_days?: string[]
          preferred_times?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      match_requests: {
        Row: {
          challenger_id: string
          court_type: Database["public"]["Enums"]["court_type"] | null
          created_at: string | null
          date: string | null
          id: string
          location: string | null
          match_type: Database["public"]["Enums"]["match_type"] | null
          opponent_id: string
          status: Database["public"]["Enums"]["match_status"] | null
          time_end: string | null
          time_start: string | null
          updated_at: string | null
        }
        Insert: {
          challenger_id: string
          court_type?: Database["public"]["Enums"]["court_type"] | null
          created_at?: string | null
          date?: string | null
          id?: string
          location?: string | null
          match_type?: Database["public"]["Enums"]["match_type"] | null
          opponent_id: string
          status?: Database["public"]["Enums"]["match_status"] | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
        }
        Update: {
          challenger_id?: string
          court_type?: Database["public"]["Enums"]["court_type"] | null
          created_at?: string | null
          date?: string | null
          id?: string
          location?: string | null
          match_type?: Database["public"]["Enums"]["match_type"] | null
          opponent_id?: string
          status?: Database["public"]["Enums"]["match_status"] | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_requests_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_requests_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_requests_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_requests_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          court_type: Database["public"]["Enums"]["court_type"]
          created_at: string | null
          date: string
          id: string
          location: string
          match_request_id: string | null
          match_type: Database["public"]["Enums"]["match_type"]
          player1_id: string
          player2_id: string
          player3_id: string | null
          player4_id: string | null
          score: string | null
          time_end: string | null
          time_start: string
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          court_type: Database["public"]["Enums"]["court_type"]
          created_at?: string | null
          date: string
          id?: string
          location: string
          match_request_id?: string | null
          match_type: Database["public"]["Enums"]["match_type"]
          player1_id: string
          player2_id: string
          player3_id?: string | null
          player4_id?: string | null
          score?: string | null
          time_end?: string | null
          time_start: string
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          court_type?: Database["public"]["Enums"]["court_type"]
          created_at?: string | null
          date?: string
          id?: string
          location?: string
          match_request_id?: string | null
          match_type?: Database["public"]["Enums"]["match_type"]
          player1_id?: string
          player2_id?: string
          player3_id?: string | null
          player4_id?: string | null
          score?: string | null
          time_end?: string | null
          time_start?: string
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_match_request_id_fkey"
            columns: ["match_request_id"]
            isOneToOne: false
            referencedRelation: "match_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player4_id_fkey"
            columns: ["player4_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player4_id_fkey"
            columns: ["player4_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          post_type: string | null
          updated_at: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          post_type?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          post_type?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          date_of_birth: string | null
          full_name: string | null
          gender: string | null
          hoa_id: string | null
          hoa_role: string | null
          hoa_status: string | null
          home_court_id: string | null
          id: string
          is_verified: boolean | null
          location: string | null
          phone_number: string | null
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          username: string | null
          usta_ranking: string | null
          utr_rating: number | null
          wtn_rating: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          hoa_id?: string | null
          hoa_role?: string | null
          hoa_status?: string | null
          home_court_id?: string | null
          id: string
          is_verified?: boolean | null
          location?: string | null
          phone_number?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          username?: string | null
          usta_ranking?: string | null
          utr_rating?: number | null
          wtn_rating?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          hoa_id?: string | null
          hoa_role?: string | null
          hoa_status?: string | null
          home_court_id?: string | null
          id?: string
          is_verified?: boolean | null
          location?: string | null
          phone_number?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          username?: string | null
          usta_ranking?: string | null
          utr_rating?: number | null
          wtn_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_court_id_fkey"
            columns: ["home_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          bonus_awarded: boolean | null
          created_at: string | null
          id: string
          referee_id: string | null
          referrer_id: string | null
        }
        Insert: {
          bonus_awarded?: boolean | null
          created_at?: string | null
          id?: string
          referee_id?: string | null
          referrer_id?: string | null
        }
        Update: {
          bonus_awarded?: boolean | null
          created_at?: string | null
          id?: string
          referee_id?: string | null
          referrer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          id: string
          player_id: string
          registration_date: string | null
          status: Database["public"]["Enums"]["registration_status"] | null
          tournament_id: string
        }
        Insert: {
          id?: string
          player_id: string
          registration_date?: string | null
          status?: Database["public"]["Enums"]["registration_status"] | null
          tournament_id: string
        }
        Update: {
          id?: string
          player_id?: string
          registration_date?: string | null
          status?: Database["public"]["Enums"]["registration_status"] | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          court_type: Database["public"]["Enums"]["court_type"]
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          location: string
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          court_type: Database["public"]["Enums"]["court_type"]
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          location: string
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          court_type?: Database["public"]["Enums"]["court_type"]
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          location?: string
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      referral_leaderboard: {
        Row: {
          id: string | null
          total_referrals: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_default_email_preferences: {
        Args: { target_user_id: string }
        Returns: {
          id: string
          user_id: string
          booking_confirmations: boolean
          booking_reminders: boolean
          cancellation_notifications: boolean
          admin_announcements: boolean
          created_at: string
          updated_at: string
        }[]
      }
      get_email_preferences: {
        Args: { target_user_id: string }
        Returns: {
          id: string
          user_id: string
          booking_confirmations: boolean
          booking_reminders: boolean
          cancellation_notifications: boolean
          admin_announcements: boolean
          created_at: string
          updated_at: string
        }[]
      }
      update_email_preference: {
        Args: {
          target_user_id: string
          preference_key: string
          preference_value: boolean
        }
        Returns: boolean
      }
    }
    Enums: {
      court_type: "hard" | "clay" | "grass" | "indoor"
      match_status: "pending" | "accepted" | "declined" | "cancelled"
      match_type: "singles" | "doubles"
      registration_status: "registered" | "confirmed" | "withdrawn"
      user_role: "player" | "coach" | "parent" | "club" | "recruiter"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      court_type: ["hard", "clay", "grass", "indoor"],
      match_status: ["pending", "accepted", "declined", "cancelled"],
      match_type: ["singles", "doubles"],
      registration_status: ["registered", "confirmed", "withdrawn"],
      user_role: ["player", "coach", "parent", "club", "recruiter"],
    },
  },
} as const
