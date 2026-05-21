
-- Add new user role enum to support coaches
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coach';

-- Create coaches table for coach-specific information
CREATE TABLE public.coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  credentials TEXT CHECK (credentials IN ('USPTA', 'PTR', 'None')),
  years_experience INTEGER CHECK (years_experience >= 0),
  sports_offered TEXT[] DEFAULT '{}',
  home_base TEXT,
  willing_to_travel BOOLEAN DEFAULT false,
  hourly_rate DECIMAL(8,2),
  bio TEXT,
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create lesson requests table
CREATE TABLE public.lesson_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES auth.users(id),
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  sport TEXT NOT NULL,
  lesson_type TEXT NOT NULL CHECK (lesson_type IN ('private', 'semi-private', 'group', 'junior')),
  skill_level TEXT NOT NULL CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  preferred_date DATE NOT NULL,
  preferred_time_start TIME NOT NULL,
  preferred_time_end TIME NOT NULL,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create coach availability table
CREATE TABLE public.coach_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(coach_id, day_of_week, start_time)
);

-- Create coach reviews table
CREATE TABLE public.coach_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  player_id UUID NOT NULL REFERENCES auth.users(id),
  lesson_request_id UUID REFERENCES public.lesson_requests(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  coach_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(lesson_request_id) -- One review per lesson
);

-- Create client notes table for coaches
CREATE TABLE public.client_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(coach_id, client_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaches table
CREATE POLICY "Coaches can view and edit their own profile" 
  ON public.coaches 
  FOR ALL 
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can view coach profiles" 
  ON public.coaches 
  FOR SELECT 
  USING (true);

-- RLS Policies for lesson_requests table
CREATE POLICY "Players can view their own lesson requests" 
  ON public.lesson_requests 
  FOR ALL 
  USING (player_id = auth.uid());

CREATE POLICY "Coaches can view requests made to them" 
  ON public.lesson_requests 
  FOR ALL 
  USING (coach_id = auth.uid());

-- RLS Policies for coach_availability table
CREATE POLICY "Coaches can manage their own availability" 
  ON public.coach_availability 
  FOR ALL 
  USING (coach_id = auth.uid());

CREATE POLICY "Anyone can view coach availability" 
  ON public.coach_availability 
  FOR SELECT 
  USING (true);

-- RLS Policies for coach_reviews table
CREATE POLICY "Players can create reviews for lessons they took" 
  ON public.coach_reviews 
  FOR INSERT 
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Anyone can view reviews" 
  ON public.coach_reviews 
  FOR SELECT 
  USING (true);

CREATE POLICY "Coaches can respond to their reviews" 
  ON public.coach_reviews 
  FOR UPDATE 
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- RLS Policies for client_notes table
CREATE POLICY "Coaches can manage their client notes" 
  ON public.client_notes 
  FOR ALL 
  USING (coach_id = auth.uid());

-- Add triggers for updated_at
CREATE TRIGGER update_coaches_updated_at 
  BEFORE UPDATE ON public.coaches 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_lesson_requests_updated_at 
  BEFORE UPDATE ON public.lesson_requests 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_coach_reviews_updated_at 
  BEFORE UPDATE ON public.coach_reviews 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_client_notes_updated_at 
  BEFORE UPDATE ON public.client_notes 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
