
export interface Coach {
  id: string;
  user_id: string;
  business_name?: string;
  credentials: 'USPTA' | 'PTR' | 'None';
  years_experience: number;
  sports_offered: string[];
  home_base: string;
  willing_to_travel: boolean;
  hourly_rate?: number;
  bio?: string;
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface LessonRequest {
  id: string;
  player_id: string;
  coach_id: string;
  sport: string;
  lesson_type: 'private' | 'semi-private' | 'group' | 'junior';
  skill_level: 'beginner' | 'intermediate' | 'advanced';
  preferred_date: string;
  preferred_time_start: string;
  preferred_time_end: string;
  location?: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CoachAvailability {
  id: string;
  coach_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface CoachReview {
  id: string;
  coach_id: string;
  player_id: string;
  lesson_request_id?: string;
  rating: number;
  review_text?: string;
  coach_response?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientNote {
  id: string;
  coach_id: string;
  client_id: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
