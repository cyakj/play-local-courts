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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      amenity_policy_agreements: {
        Row: {
          agreed_at: string
          amenity_id: string
          created_at: string
          id: string
          rules_version: string
          user_id: string
        }
        Insert: {
          agreed_at?: string
          amenity_id: string
          created_at?: string
          id?: string
          rules_version: string
          user_id: string
        }
        Update: {
          agreed_at?: string
          amenity_id?: string
          created_at?: string
          id?: string
          rules_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_policy_agreements_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
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
          doubles_duration_minutes: number | null
          doubles_only: boolean | null
          enable_peak_hours: boolean | null
          family_duration_minutes: number | null
          group_duration_minutes: number | null
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
          peak_doubles_duration_minutes: number | null
          peak_end_time: string | null
          peak_family_duration_minutes: number | null
          peak_group_duration_minutes: number | null
          peak_max_duration_minutes: number | null
          peak_singles_duration_minutes: number | null
          peak_start_time: string | null
          requires_admin_approval: boolean | null
          requires_cleanup_agreement: boolean | null
          requires_power_outlet: boolean | null
          security_deposit_amount: number | null
          security_deposit_required: boolean | null
          singles_duration_minutes: number | null
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
          doubles_duration_minutes?: number | null
          doubles_only?: boolean | null
          enable_peak_hours?: boolean | null
          family_duration_minutes?: number | null
          group_duration_minutes?: number | null
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
          peak_doubles_duration_minutes?: number | null
          peak_end_time?: string | null
          peak_family_duration_minutes?: number | null
          peak_group_duration_minutes?: number | null
          peak_max_duration_minutes?: number | null
          peak_singles_duration_minutes?: number | null
          peak_start_time?: string | null
          requires_admin_approval?: boolean | null
          requires_cleanup_agreement?: boolean | null
          requires_power_outlet?: boolean | null
          security_deposit_amount?: number | null
          security_deposit_required?: boolean | null
          singles_duration_minutes?: number | null
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
          doubles_duration_minutes?: number | null
          doubles_only?: boolean | null
          enable_peak_hours?: boolean | null
          family_duration_minutes?: number | null
          group_duration_minutes?: number | null
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
          peak_doubles_duration_minutes?: number | null
          peak_end_time?: string | null
          peak_family_duration_minutes?: number | null
          peak_group_duration_minutes?: number | null
          peak_max_duration_minutes?: number | null
          peak_singles_duration_minutes?: number | null
          peak_start_time?: string | null
          requires_admin_approval?: boolean | null
          requires_cleanup_agreement?: boolean | null
          requires_power_outlet?: boolean | null
          security_deposit_amount?: number | null
          security_deposit_required?: boolean | null
          singles_duration_minutes?: number | null
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
          {
            foreignKeyName: "amenity_rules_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notifications: {
        Row: {
          application_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "hoa_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_by: string | null
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
          cancellation_reason?: string | null
          cancelled_by?: string | null
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
          cancellation_reason?: string | null
          cancelled_by?: string | null
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
      client_assignments: {
        Row: {
          client_id: string
          coach_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string | null
          id: string
          is_hidden: boolean | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
            referencedRelation: "public_profiles"
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
      coach_availability: {
        Row: {
          coach_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: []
      }
      coach_favorites: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          player_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          player_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          player_id?: string
        }
        Relationships: []
      }
      coach_reviews: {
        Row: {
          coach_id: string
          coach_response: string | null
          created_at: string | null
          id: string
          lesson_request_id: string | null
          player_id: string
          rating: number
          review_text: string | null
          updated_at: string | null
        }
        Insert: {
          coach_id: string
          coach_response?: string | null
          created_at?: string | null
          id?: string
          lesson_request_id?: string | null
          player_id: string
          rating: number
          review_text?: string | null
          updated_at?: string | null
        }
        Update: {
          coach_id?: string
          coach_response?: string | null
          created_at?: string | null
          id?: string
          lesson_request_id?: string | null
          player_id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_reviews_lesson_request_id_fkey"
            columns: ["lesson_request_id"]
            isOneToOne: true
            referencedRelation: "lesson_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_unavailability: {
        Row: {
          coach_id: string
          created_at: string | null
          end_date: string
          id: string
          notes: string | null
          recurs_annually: boolean | null
          start_date: string
          title: string | null
          type: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          end_date: string
          id?: string
          notes?: string | null
          recurs_annually?: boolean | null
          start_date: string
          title?: string | null
          type: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          recurs_annually?: boolean | null
          start_date?: string
          title?: string | null
          type?: string
        }
        Relationships: []
      }
      coaches: {
        Row: {
          bio: string | null
          business_name: string | null
          cancellation_policy_hours: number | null
          created_at: string | null
          credentials: string | null
          home_base: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          latitude: number | null
          levels_served: string[] | null
          longitude: number | null
          profile_image_url: string | null
          sports_offered: string[] | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          willing_to_travel: boolean | null
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          business_name?: string | null
          cancellation_policy_hours?: number | null
          created_at?: string | null
          credentials?: string | null
          home_base?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          levels_served?: string[] | null
          longitude?: number | null
          profile_image_url?: string | null
          sports_offered?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          willing_to_travel?: boolean | null
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          business_name?: string | null
          cancellation_policy_hours?: number | null
          created_at?: string | null
          credentials?: string | null
          home_base?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          levels_served?: string[] | null
          longitude?: number | null
          profile_image_url?: string | null
          sports_offered?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          willing_to_travel?: boolean | null
          years_experience?: number | null
        }
        Relationships: []
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
            referencedRelation: "public_profiles"
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
      community_join_requests: {
        Row: {
          created_at: string
          hoa_id: string
          id: string
          message: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hoa_id: string
          id?: string
          message?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hoa_id?: string
          id?: string
          message?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_join_requests_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_join_requests_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_notifications: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_notifications_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "ladders"
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
          {
            foreignKeyName: "courts_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      document_views: {
        Row: {
          document_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          document_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          document_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_views_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "hoa_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard"
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
          lesson_confirmations: boolean | null
          lesson_reminders: boolean | null
          match_confirmations: boolean | null
          match_reminders: boolean | null
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
          lesson_confirmations?: boolean | null
          lesson_reminders?: boolean | null
          match_confirmations?: boolean | null
          match_reminders?: boolean | null
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
          lesson_confirmations?: boolean | null
          lesson_reminders?: boolean | null
          match_confirmations?: boolean | null
          match_reminders?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_reminders_sent: {
        Row: {
          event_id: string
          event_type: string
          id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hoa_announcements: {
        Row: {
          audience: string
          body: string
          created_at: string | null
          created_by: string
          hoa_id: string
          id: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string | null
          created_by: string
          hoa_id: string
          id?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string | null
          created_by?: string
          hoa_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_announcements_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_announcements_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_application_notes: {
        Row: {
          application_id: string
          created_at: string
          id: string
          note: string
          reviewer_id: string
          status_change: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          note: string
          reviewer_id: string
          status_change?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          note?: string
          reviewer_id?: string
          status_change?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoa_application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "hoa_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_applications: {
        Row: {
          applicant_id: string
          claimed_role: string
          claimed_role_other: string | null
          community_location: string
          created_at: string
          created_hoa_id: string | null
          estimated_residents: number
          hoa_name: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
          verification_documents: string[] | null
        }
        Insert: {
          applicant_id: string
          claimed_role: string
          claimed_role_other?: string | null
          community_location: string
          created_at?: string
          created_hoa_id?: string | null
          estimated_residents: number
          hoa_name: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          verification_documents?: string[] | null
        }
        Update: {
          applicant_id?: string
          claimed_role?: string
          claimed_role_other?: string | null
          community_location?: string
          created_at?: string
          created_hoa_id?: string | null
          estimated_residents?: number
          hoa_name?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          verification_documents?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "hoa_applications_created_hoa_id_fkey"
            columns: ["created_hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_applications_created_hoa_id_fkey"
            columns: ["created_hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_documents: {
        Row: {
          category: string
          created_at: string | null
          file_name: string
          file_size_bytes: number | null
          file_url: string
          hoa_id: string
          id: string
          title: string
          uploaded_by: string
          visibility: string
        }
        Insert: {
          category: string
          created_at?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          hoa_id: string
          id?: string
          title: string
          uploaded_by: string
          visibility?: string
        }
        Update: {
          category?: string
          created_at?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          hoa_id?: string
          id?: string
          title?: string
          uploaded_by?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_documents_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_documents_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_event_rsvps: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          response: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          response: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          response?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hoa_events"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_events: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          ends_at: string | null
          event_type: string
          hoa_id: string
          id: string
          location: string | null
          rsvp_enabled: boolean | null
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          ends_at?: string | null
          event_type: string
          hoa_id: string
          id?: string
          location?: string | null
          rsvp_enabled?: boolean | null
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          hoa_id?: string
          id?: string
          location?: string | null
          rsvp_enabled?: boolean | null
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_events_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_events_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_memberships: {
        Row: {
          created_at: string
          hoa_id: string
          id: string
          invite_code_used: string | null
          is_primary: boolean
          joined_via_invite: boolean
          last_active_at: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hoa_id: string
          id?: string
          invite_code_used?: string | null
          is_primary?: boolean
          joined_via_invite?: boolean
          last_active_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hoa_id?: string
          id?: string
          invite_code_used?: string | null
          is_primary?: boolean
          joined_via_invite?: boolean
          last_active_at?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_memberships_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_memberships_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_notifications: {
        Row: {
          body: string
          created_at: string | null
          hoa_id: string | null
          id: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          hoa_id?: string | null
          id?: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          hoa_id?: string | null
          id?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_notifications_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_notifications_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_survey_questions: {
        Row: {
          id: string
          options: Json | null
          position: number
          question_text: string
          question_type: string
          required: boolean
          survey_id: string
        }
        Insert: {
          id?: string
          options?: Json | null
          position?: number
          question_text: string
          question_type: string
          required?: boolean
          survey_id: string
        }
        Update: {
          id?: string
          options?: Json | null
          position?: number
          question_text?: string
          question_type?: string
          required?: boolean
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "hoa_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_survey_responses: {
        Row: {
          answers: Json
          id: string
          submitted_at: string | null
          survey_id: string
          user_id: string
        }
        Insert: {
          answers: Json
          id?: string
          submitted_at?: string | null
          survey_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          id?: string
          submitted_at?: string | null
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "hoa_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_surveys: {
        Row: {
          anonymous: boolean
          audience: string
          closes_at: string
          created_at: string | null
          created_by: string
          description: string | null
          hoa_id: string
          id: string
          opens_at: string
          results_reveal: string
          results_visibility: string
          status: string
          title: string
        }
        Insert: {
          anonymous?: boolean
          audience?: string
          closes_at: string
          created_at?: string | null
          created_by: string
          description?: string | null
          hoa_id: string
          id?: string
          opens_at?: string
          results_reveal?: string
          results_visibility?: string
          status?: string
          title: string
        }
        Update: {
          anonymous?: boolean
          audience?: string
          closes_at?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          hoa_id?: string
          id?: string
          opens_at?: string
          results_reveal?: string
          results_visibility?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_surveys_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_surveys_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      hoas: {
        Row: {
          address: string | null
          admin_id: string | null
          community_type: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          invite_code: string | null
          invite_enabled: boolean
          invite_expires_at: string | null
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          admin_id?: string | null
          community_type?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          invite_code?: string | null
          invite_enabled?: boolean
          invite_expires_at?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          admin_id?: string | null
          community_type?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          invite_code?: string | null
          invite_enabled?: boolean
          invite_expires_at?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ladder_invitations: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_user_id: string
          ladder_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_user_id: string
          ladder_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          ladder_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_invitations_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_matches: {
        Row: {
          created_at: string
          deadline_date: string | null
          dispute_reason: string | null
          extension_days: number | null
          extension_reason: string | null
          extension_requested_by: string | null
          extension_status: string | null
          id: string
          is_retirement: boolean | null
          is_void: boolean | null
          is_walkover: boolean | null
          ladder_id: string
          original_deadline_date: string | null
          playoff_stage: Database["public"]["Enums"]["playoff_stage"] | null
          points_awarded: number | null
          retired_by_team_id: string | null
          round_number: number | null
          scheduled_date: string | null
          score_photo_url_team1: string | null
          score_photo_url_team2: string | null
          status: Database["public"]["Enums"]["match_status"]
          submitted_at: string | null
          submitted_by: string | null
          super_tiebreak: boolean | null
          team1_id: string
          team1_score_games: number | null
          team1_score_sets: number | null
          team2_id: string
          team2_score_games: number | null
          team2_score_sets: number | null
          updated_at: string
          winner_team_id: string | null
        }
        Insert: {
          created_at?: string
          deadline_date?: string | null
          dispute_reason?: string | null
          extension_days?: number | null
          extension_reason?: string | null
          extension_requested_by?: string | null
          extension_status?: string | null
          id?: string
          is_retirement?: boolean | null
          is_void?: boolean | null
          is_walkover?: boolean | null
          ladder_id: string
          original_deadline_date?: string | null
          playoff_stage?: Database["public"]["Enums"]["playoff_stage"] | null
          points_awarded?: number | null
          retired_by_team_id?: string | null
          round_number?: number | null
          scheduled_date?: string | null
          score_photo_url_team1?: string | null
          score_photo_url_team2?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          super_tiebreak?: boolean | null
          team1_id: string
          team1_score_games?: number | null
          team1_score_sets?: number | null
          team2_id: string
          team2_score_games?: number | null
          team2_score_sets?: number | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Update: {
          created_at?: string
          deadline_date?: string | null
          dispute_reason?: string | null
          extension_days?: number | null
          extension_reason?: string | null
          extension_requested_by?: string | null
          extension_status?: string | null
          id?: string
          is_retirement?: boolean | null
          is_void?: boolean | null
          is_walkover?: boolean | null
          ladder_id?: string
          original_deadline_date?: string | null
          playoff_stage?: Database["public"]["Enums"]["playoff_stage"] | null
          points_awarded?: number | null
          retired_by_team_id?: string | null
          round_number?: number | null
          scheduled_date?: string | null
          score_photo_url_team1?: string | null
          score_photo_url_team2?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          super_tiebreak?: boolean | null
          team1_id?: string
          team1_score_games?: number | null
          team1_score_sets?: number | null
          team2_id?: string
          team2_score_games?: number | null
          team2_score_sets?: number | null
          updated_at?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ladder_matches_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_matches_retired_by_team_id_fkey"
            columns: ["retired_by_team_id"]
            isOneToOne: false
            referencedRelation: "ladder_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "ladder_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "ladder_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladder_matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "ladder_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_registration_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          ladder_id: string
          looking_for_partner: boolean | null
          message: string | null
          partner_id: string | null
          player_id: string
          status: string
          team_name: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          ladder_id: string
          looking_for_partner?: boolean | null
          message?: string | null
          partner_id?: string | null
          player_id: string
          status?: string
          team_name: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          ladder_id?: string
          looking_for_partner?: boolean | null
          message?: string | null
          partner_id?: string | null
          player_id?: string
          status?: string
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ladder_registration_requests_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      ladder_teams: {
        Row: {
          created_at: string
          dispute_strikes: number | null
          freeze_end_date: string | null
          freeze_start_date: string | null
          games_played: number
          id: string
          is_frozen: boolean | null
          is_withdrawn: boolean | null
          ladder_id: string
          losses: number
          player1_id: string
          player2_id: string | null
          team_name: string
          total_points: number
          walkover_losses: number | null
          wins: number
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          dispute_strikes?: number | null
          freeze_end_date?: string | null
          freeze_start_date?: string | null
          games_played?: number
          id?: string
          is_frozen?: boolean | null
          is_withdrawn?: boolean | null
          ladder_id: string
          losses?: number
          player1_id: string
          player2_id?: string | null
          team_name: string
          total_points?: number
          walkover_losses?: number | null
          wins?: number
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          dispute_strikes?: number | null
          freeze_end_date?: string | null
          freeze_start_date?: string | null
          games_played?: number
          id?: string
          is_frozen?: boolean | null
          is_withdrawn?: boolean | null
          ladder_id?: string
          losses?: number
          player1_id?: string
          player2_id?: string | null
          team_name?: string
          total_points?: number
          walkover_losses?: number | null
          wins?: number
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ladder_teams_ladder_id_fkey"
            columns: ["ladder_id"]
            isOneToOne: false
            referencedRelation: "ladders"
            referencedColumns: ["id"]
          },
        ]
      }
      ladders: {
        Row: {
          acceptance_window_hours: number | null
          admin_id: string
          auto_approve_registration: boolean | null
          challenge_range: number | null
          city: string | null
          created_at: string
          defense_period_days: number | null
          description: string | null
          dispute_window_hours: number | null
          enable_playoffs: boolean | null
          end_date: string | null
          format: Database["public"]["Enums"]["ladder_format"]
          gender_restriction: string | null
          hoa_id: string | null
          hoa_only: boolean | null
          id: string
          image_url: string | null
          is_private: boolean
          loss_points: number | null
          max_age: number | null
          max_freeze_days: number | null
          max_ntrp: number | null
          max_teams: number | null
          min_age: number | null
          min_ntrp: number | null
          min_players_required: number | null
          name: string
          participation_points: number | null
          play_by_deadline_days: number | null
          playoff_format: string | null
          playoff_teams_count: number | null
          points_per_set: number | null
          points_per_win: number | null
          registration_deadline: string | null
          require_score_confirmation: boolean | null
          score_photo_required: boolean | null
          scoring_format: string | null
          scoring_mode: string | null
          secondary_tiebreaker: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["ladder_status"]
          third_set_format: string | null
          tiebreaker_rule: string | null
          updated_at: string
          weekly_deadline_day: number | null
        }
        Insert: {
          acceptance_window_hours?: number | null
          admin_id: string
          auto_approve_registration?: boolean | null
          challenge_range?: number | null
          city?: string | null
          created_at?: string
          defense_period_days?: number | null
          description?: string | null
          dispute_window_hours?: number | null
          enable_playoffs?: boolean | null
          end_date?: string | null
          format?: Database["public"]["Enums"]["ladder_format"]
          gender_restriction?: string | null
          hoa_id?: string | null
          hoa_only?: boolean | null
          id?: string
          image_url?: string | null
          is_private?: boolean
          loss_points?: number | null
          max_age?: number | null
          max_freeze_days?: number | null
          max_ntrp?: number | null
          max_teams?: number | null
          min_age?: number | null
          min_ntrp?: number | null
          min_players_required?: number | null
          name: string
          participation_points?: number | null
          play_by_deadline_days?: number | null
          playoff_format?: string | null
          playoff_teams_count?: number | null
          points_per_set?: number | null
          points_per_win?: number | null
          registration_deadline?: string | null
          require_score_confirmation?: boolean | null
          score_photo_required?: boolean | null
          scoring_format?: string | null
          scoring_mode?: string | null
          secondary_tiebreaker?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["ladder_status"]
          third_set_format?: string | null
          tiebreaker_rule?: string | null
          updated_at?: string
          weekly_deadline_day?: number | null
        }
        Update: {
          acceptance_window_hours?: number | null
          admin_id?: string
          auto_approve_registration?: boolean | null
          challenge_range?: number | null
          city?: string | null
          created_at?: string
          defense_period_days?: number | null
          description?: string | null
          dispute_window_hours?: number | null
          enable_playoffs?: boolean | null
          end_date?: string | null
          format?: Database["public"]["Enums"]["ladder_format"]
          gender_restriction?: string | null
          hoa_id?: string | null
          hoa_only?: boolean | null
          id?: string
          image_url?: string | null
          is_private?: boolean
          loss_points?: number | null
          max_age?: number | null
          max_freeze_days?: number | null
          max_ntrp?: number | null
          max_teams?: number | null
          min_age?: number | null
          min_ntrp?: number | null
          min_players_required?: number | null
          name?: string
          participation_points?: number | null
          play_by_deadline_days?: number | null
          playoff_format?: string | null
          playoff_teams_count?: number | null
          points_per_set?: number | null
          points_per_win?: number | null
          registration_deadline?: string | null
          require_score_confirmation?: boolean | null
          score_photo_required?: boolean | null
          scoring_format?: string | null
          scoring_mode?: string | null
          secondary_tiebreaker?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["ladder_status"]
          third_set_format?: string | null
          tiebreaker_rule?: string | null
          updated_at?: string
          weekly_deadline_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ladders_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ladders_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          coach_id: string
          content: string | null
          created_at: string
          id: string
          lesson_request_id: string
          takeaways: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          content?: string | null
          created_at?: string
          id?: string
          lesson_request_id: string
          takeaways?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          content?: string | null
          created_at?: string
          id?: string
          lesson_request_id?: string
          takeaways?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_lesson_request_id_fkey"
            columns: ["lesson_request_id"]
            isOneToOne: true
            referencedRelation: "lesson_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_requests: {
        Row: {
          attendance_marked_at: string | null
          attendance_marked_by: string | null
          attendance_status: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          coach_id: string
          confirmed_date: string | null
          confirmed_time_end: string | null
          confirmed_time_start: string | null
          counter_proposed_date: string | null
          counter_proposed_notes: string | null
          counter_proposed_time_end: string | null
          counter_proposed_time_start: string | null
          created_at: string | null
          duration_minutes: number | null
          expires_at: string | null
          id: string
          lesson_type: string
          location: string | null
          no_show_by: string | null
          notes: string | null
          package_hold_id: string | null
          player_id: string
          preferred_date: string
          preferred_dates: string[] | null
          preferred_time_end: string
          preferred_time_start: string
          recurring_series_id: string | null
          review_eligible_at: string | null
          skill_level: string
          sport: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          attendance_status?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          coach_id: string
          confirmed_date?: string | null
          confirmed_time_end?: string | null
          confirmed_time_start?: string | null
          counter_proposed_date?: string | null
          counter_proposed_notes?: string | null
          counter_proposed_time_end?: string | null
          counter_proposed_time_start?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          lesson_type: string
          location?: string | null
          no_show_by?: string | null
          notes?: string | null
          package_hold_id?: string | null
          player_id: string
          preferred_date: string
          preferred_dates?: string[] | null
          preferred_time_end: string
          preferred_time_start: string
          recurring_series_id?: string | null
          review_eligible_at?: string | null
          skill_level: string
          sport: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          attendance_status?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          coach_id?: string
          confirmed_date?: string | null
          confirmed_time_end?: string | null
          confirmed_time_start?: string | null
          counter_proposed_date?: string | null
          counter_proposed_notes?: string | null
          counter_proposed_time_end?: string | null
          counter_proposed_time_start?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          expires_at?: string | null
          id?: string
          lesson_type?: string
          location?: string | null
          no_show_by?: string | null
          notes?: string | null
          package_hold_id?: string | null
          player_id?: string
          preferred_date?: string
          preferred_dates?: string[] | null
          preferred_time_end?: string
          preferred_time_start?: string
          recurring_series_id?: string | null
          review_eligible_at?: string | null
          skill_level?: string
          sport?: string
          status?: string | null
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
            referencedRelation: "public_profiles"
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
      maintenance_reports: {
        Row: {
          admin_notes: string | null
          amenity_id: string | null
          assignee: string | null
          category: string
          closed_at: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          description: string
          hoa_id: string
          id: string
          is_urgent: boolean
          location_text: string | null
          photo_url: string | null
          priority: string | null
          report_type: string
          reporter_id: string
          resolution_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amenity_id?: string | null
          assignee?: string | null
          category: string
          closed_at?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description: string
          hoa_id: string
          id?: string
          is_urgent?: boolean
          location_text?: string | null
          photo_url?: string | null
          priority?: string | null
          report_type?: string
          reporter_id: string
          resolution_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amenity_id?: string | null
          assignee?: string | null
          category?: string
          closed_at?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string
          hoa_id?: string
          id?: string
          is_urgent?: boolean
          location_text?: string | null
          photo_url?: string | null
          priority?: string | null
          report_type?: string
          reporter_id?: string
          resolution_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          availability_type: string
          challenger_id: string
          court_type: Database["public"]["Enums"]["court_type"] | null
          created_at: string | null
          date: string | null
          duration: number | null
          expires_at: string
          id: string
          location: string | null
          match_type: Database["public"]["Enums"]["match_type"] | null
          message: string | null
          opponent_id: string
          status: Database["public"]["Enums"]["match_status"] | null
          time_end: string | null
          time_start: string | null
          updated_at: string | null
        }
        Insert: {
          availability_type?: string
          challenger_id: string
          court_type?: Database["public"]["Enums"]["court_type"] | null
          created_at?: string | null
          date?: string | null
          duration?: number | null
          expires_at?: string
          id?: string
          location?: string | null
          match_type?: Database["public"]["Enums"]["match_type"] | null
          message?: string | null
          opponent_id: string
          status?: Database["public"]["Enums"]["match_status"] | null
          time_end?: string | null
          time_start?: string | null
          updated_at?: string | null
        }
        Update: {
          availability_type?: string
          challenger_id?: string
          court_type?: Database["public"]["Enums"]["court_type"] | null
          created_at?: string | null
          date?: string | null
          duration?: number | null
          expires_at?: string
          id?: string
          location?: string | null
          match_type?: Database["public"]["Enums"]["match_type"] | null
          message?: string | null
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
            referencedRelation: "public_profiles"
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
            referencedRelation: "public_profiles"
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
      match_reschedule_requests: {
        Row: {
          created_at: string
          id: string
          match_id: string
          message: string | null
          proposed_date: string | null
          proposed_end_time: string | null
          proposed_start_time: string | null
          reason: string | null
          requester_user_id: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          message?: string | null
          proposed_date?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          reason?: string | null
          requester_user_id: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          message?: string | null
          proposed_date?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          reason?: string | null
          requester_user_id?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_reschedule_requests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
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
          status: Database["public"]["Enums"]["match_lifecycle_status"]
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
          status?: Database["public"]["Enums"]["match_lifecycle_status"]
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
          status?: Database["public"]["Enums"]["match_lifecycle_status"]
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
            referencedRelation: "public_profiles"
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
            referencedRelation: "public_profiles"
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
            referencedRelation: "public_profiles"
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
            referencedRelation: "public_profiles"
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
            referencedRelation: "public_profiles"
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
          read_at: string | null
          receiver_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          arrival_date: string | null
          created_at: string
          currency: string
          id: string
          status: string
          stripe_account_id: string
          stripe_payout_id: string
        }
        Insert: {
          amount: number
          arrival_date?: string | null
          created_at?: string
          currency?: string
          id?: string
          status: string
          stripe_account_id: string
          stripe_payout_id: string
        }
        Update: {
          amount?: number
          arrival_date?: string | null
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_account_id?: string
          stripe_payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_stripe_account_id_fkey"
            columns: ["stripe_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_accounts"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "public_profiles"
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
          hide_contact_until_confirmed: boolean | null
          hoa_id: string | null
          hoa_role: string | null
          hoa_status: string | null
          home_court_id: string | null
          id: string
          is_verified: boolean | null
          latitude: number | null
          location: string | null
          location_visible: boolean | null
          longitude: number | null
          notification_preferences: Json | null
          ntrp_rating: number | null
          phone_number: string | null
          preferred_court_locations: string | null
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          show_activity_status: boolean | null
          show_exact_distance: boolean | null
          unit_number: string | null
          updated_at: string | null
          user_type: string | null
          username: string | null
          usta_ranking: string | null
          utr_rating: number | null
          wtn_rating: number | null
          zip_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          hide_contact_until_confirmed?: boolean | null
          hoa_id?: string | null
          hoa_role?: string | null
          hoa_status?: string | null
          home_court_id?: string | null
          id: string
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          location_visible?: boolean | null
          longitude?: number | null
          notification_preferences?: Json | null
          ntrp_rating?: number | null
          phone_number?: string | null
          preferred_court_locations?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          show_activity_status?: boolean | null
          show_exact_distance?: boolean | null
          unit_number?: string | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          usta_ranking?: string | null
          utr_rating?: number | null
          wtn_rating?: number | null
          zip_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          hide_contact_until_confirmed?: boolean | null
          hoa_id?: string | null
          hoa_role?: string | null
          hoa_status?: string | null
          home_court_id?: string | null
          id?: string
          is_verified?: boolean | null
          latitude?: number | null
          location?: string | null
          location_visible?: boolean | null
          longitude?: number | null
          notification_preferences?: Json | null
          ntrp_rating?: number | null
          phone_number?: string | null
          preferred_court_locations?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          show_activity_status?: boolean | null
          show_exact_distance?: boolean | null
          unit_number?: string | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          usta_ranking?: string | null
          utr_rating?: number | null
          wtn_rating?: number | null
          zip_code?: string | null
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
            foreignKeyName: "profiles_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
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
            referencedRelation: "public_profiles"
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
            referencedRelation: "public_profiles"
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
            referencedRelation: "public_profiles"
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
      report_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          report_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          report_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          report_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "maintenance_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          report_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          report_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_notes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "maintenance_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_accounts: {
        Row: {
          charges_enabled: boolean | null
          coach_id: string
          created_at: string
          details_submitted: boolean | null
          id: string
          payouts_enabled: boolean | null
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean | null
          coach_id: string
          created_at?: string
          details_submitted?: boolean | null
          id?: string
          payouts_enabled?: boolean | null
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean | null
          coach_id?: string
          created_at?: string
          details_submitted?: boolean | null
          id?: string
          payouts_enabled?: boolean | null
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_accounts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["user_id"]
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
            referencedRelation: "public_profiles"
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
      transactions: {
        Row: {
          amount: number
          coach_id: string
          created_at: string
          currency: string
          id: string
          lesson_request_id: string
          player_id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          coach_id: string
          created_at?: string
          currency?: string
          id?: string
          lesson_request_id: string
          player_id: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          coach_id?: string
          created_at?: string
          currency?: string
          id?: string
          lesson_request_id?: string
          player_id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_lesson_request_id_fkey"
            columns: ["lesson_request_id"]
            isOneToOne: false
            referencedRelation: "lesson_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_hoa_directory: {
        Row: {
          community_type: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          community_type?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          community_type?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          gender: string | null
          hide_contact_until_confirmed: boolean | null
          hoa_id: string | null
          hoa_role: string | null
          hoa_status: string | null
          home_court_id: string | null
          id: string | null
          is_verified: boolean | null
          location: string | null
          location_visible: boolean | null
          ntrp_rating: number | null
          preferred_court_locations: string | null
          show_activity_status: boolean | null
          show_exact_distance: boolean | null
          updated_at: string | null
          user_type: string | null
          username: string | null
          usta_ranking: string | null
          utr_rating: number | null
          wtn_rating: number | null
          zip_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          gender?: string | null
          hide_contact_until_confirmed?: boolean | null
          hoa_id?: string | null
          hoa_role?: string | null
          hoa_status?: string | null
          home_court_id?: string | null
          id?: string | null
          is_verified?: boolean | null
          location?: string | null
          location_visible?: boolean | null
          ntrp_rating?: number | null
          preferred_court_locations?: string | null
          show_activity_status?: boolean | null
          show_exact_distance?: boolean | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          usta_ranking?: string | null
          utr_rating?: number | null
          wtn_rating?: number | null
          zip_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          gender?: string | null
          hide_contact_until_confirmed?: boolean | null
          hoa_id?: string | null
          hoa_role?: string | null
          hoa_status?: string | null
          home_court_id?: string | null
          id?: string | null
          is_verified?: boolean | null
          location?: string | null
          location_visible?: boolean | null
          ntrp_rating?: number | null
          preferred_court_locations?: string | null
          show_activity_status?: boolean | null
          show_exact_distance?: boolean | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          usta_ranking?: string | null
          utr_rating?: number | null
          wtn_rating?: number | null
          zip_code?: string | null
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
            foreignKeyName: "profiles_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "public_hoa_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_court_id_fkey"
            columns: ["home_court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      approve_hoa_application: {
        Args: { application_id: string; reviewer_note?: string }
        Returns: string
      }
      approve_hoa_membership: {
        Args: { membership_id: string }
        Returns: boolean
      }
      calculate_ladder_points: {
        Args: {
          loser_games: number
          super_tiebreak?: boolean
          winner_games: number
        }
        Returns: number
      }
      can_create_ladder: {
        Args: { _admin_id: string; _hoa_id: string }
        Returns: boolean
      }
      can_view_ladder: { Args: { _ladder_id: string }; Returns: boolean }
      can_view_ladder_row: {
        Args: { _admin_id: string; _hoa_id: string; _ladder_id: string }
        Returns: boolean
      }
      check_competition_create_permission: {
        Args: { _hoa_id?: string }
        Returns: Json
      }
      check_hoa_admin: {
        Args: { _hoa_id: string; _user_id: string }
        Returns: boolean
      }
      create_community: {
        Args: {
          community_address?: string
          community_name: string
          community_type?: string
          description?: string
          logo_url?: string
        }
        Returns: string
      }
      create_competition_ladder: {
        Args: {
          _acceptance_window_hours?: number
          _auto_approve_registration?: boolean
          _challenge_range?: number
          _city?: string
          _description?: string
          _dispute_window_hours?: number
          _enable_playoffs?: boolean
          _end_date?: string
          _format?: Database["public"]["Enums"]["ladder_format"]
          _gender_restriction?: string
          _hoa_id?: string
          _hoa_only?: boolean
          _is_private?: boolean
          _loss_points?: number
          _max_age?: number
          _max_freeze_days?: number
          _max_ntrp?: number
          _max_teams?: number
          _min_age?: number
          _min_ntrp?: number
          _min_players_required?: number
          _name: string
          _play_by_deadline_days?: number
          _playoff_teams_count?: number
          _points_per_set?: number
          _points_per_win?: number
          _registration_deadline?: string
          _require_score_confirmation?: boolean
          _scoring_format?: string
          _scoring_mode?: string
          _secondary_tiebreaker?: string
          _start_date?: string
          _status?: Database["public"]["Enums"]["ladder_status"]
          _third_set_format?: string
          _tiebreaker_rule?: string
        }
        Returns: Json
      }
      create_default_email_preferences: {
        Args: { target_user_id: string }
        Returns: {
          admin_announcements: boolean
          booking_confirmations: boolean
          booking_reminders: boolean
          cancellation_notifications: boolean
          created_at: string
          id: string
          lesson_confirmations: boolean
          lesson_reminders: boolean
          match_confirmations: boolean
          match_reminders: boolean
          updated_at: string
          user_id: string
        }[]
      }
      create_maintenance_report: {
        Args: {
          _amenity_id?: string
          _category: string
          _description: string
          _hoa_id: string
          _location_text?: string
          _photo_url?: string
          _report_type?: string
          _status?: string
        }
        Returns: string
      }
      generate_invite_code: { Args: { _name: string }; Returns: string }
      generate_round_robin_matches: {
        Args: { ladder_id_param: string }
        Returns: number
      }
      get_coaches_near: {
        Args: { player_lat: number; player_lng: number; radius_km?: number }
        Returns: {
          coach_user_id: string
          distance_km: number
        }[]
      }
      get_email_preferences: {
        Args: { target_user_id: string }
        Returns: {
          admin_announcements: boolean
          booking_confirmations: boolean
          booking_reminders: boolean
          cancellation_notifications: boolean
          created_at: string
          id: string
          lesson_confirmations: boolean
          lesson_reminders: boolean
          match_confirmations: boolean
          match_reminders: boolean
          updated_at: string
          user_id: string
        }[]
      }
      get_public_hoa_invite_by_code: {
        Args: { _invite_code: string }
        Returns: {
          id: string
          invite_enabled: boolean
          invite_expires_at: string
          name: string
        }[]
      }
      get_public_survey_results: {
        Args: { _survey_id: string }
        Returns: {
          answers: Json
        }[]
      }
      get_survey_member_count: { Args: { _survey_id: string }; Returns: number }
      grant_admin_role: { Args: { target_user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_in_same_hoa: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_in_same_hoa: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_ladder_admin: { Args: { _ladder_id: string }; Returns: boolean }
      migrate_existing_hoa_memberships: { Args: never; Returns: undefined }
      regenerate_invite_code: { Args: { _hoa_id: string }; Returns: string }
      reject_hoa_membership: {
        Args: { membership_id: string }
        Returns: boolean
      }
      request_hoa_membership: {
        Args: { join_message?: string; target_hoa_id: string }
        Returns: string
      }
      request_join_community: {
        Args: { join_message?: string; target_hoa_id: string }
        Returns: string
      }
      set_active_hoa: { Args: { target_hoa_id: string }; Returns: boolean }
      update_email_preference: {
        Args: {
          preference_key: string
          preference_value: boolean
          target_user_id: string
        }
        Returns: boolean
      }
      update_hoa_application_status: {
        Args: {
          application_id: string
          new_status: string
          reviewer_note: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "resident"
        | "coach"
        | "platform_reviewer"
        | "maintenance_worker"
        | "condo_manager"
      court_type: "hard" | "clay" | "grass" | "indoor"
      ladder_format: "singles" | "doubles"
      ladder_status: "setup" | "active" | "completed"
      match_lifecycle_status:
        | "scheduled"
        | "reschedule_requested"
        | "cancelled"
        | "completed"
      match_status: "pending" | "accepted" | "declined" | "cancelled"
      match_type: "singles" | "doubles" | "mixed_doubles" | "hitting_session"
      playoff_stage: "semifinals" | "final" | "third_place"
      registration_status: "registered" | "confirmed" | "withdrawn"
      user_role: "player" | "coach" | "parent" | "club" | "recruiter"
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
  public: {
    Enums: {
      app_role: [
        "admin",
        "resident",
        "coach",
        "platform_reviewer",
        "maintenance_worker",
        "condo_manager",
      ],
      court_type: ["hard", "clay", "grass", "indoor"],
      ladder_format: ["singles", "doubles"],
      ladder_status: ["setup", "active", "completed"],
      match_lifecycle_status: [
        "scheduled",
        "reschedule_requested",
        "cancelled",
        "completed",
      ],
      match_status: ["pending", "accepted", "declined", "cancelled"],
      match_type: ["singles", "doubles", "mixed_doubles", "hitting_session"],
      playoff_stage: ["semifinals", "final", "third_place"],
      registration_status: ["registered", "confirmed", "withdrawn"],
      user_role: ["player", "coach", "parent", "club", "recruiter"],
    },
  },
} as const

