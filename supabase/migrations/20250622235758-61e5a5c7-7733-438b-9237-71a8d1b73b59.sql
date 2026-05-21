
-- Create enum types for ladder system (only if they don't exist)
DO $$ BEGIN
    CREATE TYPE ladder_format AS ENUM ('singles', 'doubles');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ladder_status AS ENUM ('setup', 'active', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE playoff_stage AS ENUM ('semifinals', 'final', 'third_place');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ladders table
CREATE TABLE public.ladders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  hoa_id UUID NOT NULL REFERENCES public.hoas(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format ladder_format NOT NULL DEFAULT 'doubles',
  status ladder_status NOT NULL DEFAULT 'setup',
  is_private BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  weekly_deadline_day INTEGER, -- 0=Sunday, 1=Monday, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT
);

-- Create ladder_teams table (handles both singles players and doubles teams)
CREATE TABLE public.ladder_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ladder_id UUID NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for singles
  total_points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ladder_id, team_name)
);

-- Create ladder_matches table for round-robin and playoff matches
CREATE TABLE public.ladder_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ladder_id UUID NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  team1_id UUID NOT NULL REFERENCES public.ladder_teams(id) ON DELETE CASCADE,
  team2_id UUID NOT NULL REFERENCES public.ladder_teams(id) ON DELETE CASCADE,
  round_number INTEGER, -- NULL for playoffs
  playoff_stage playoff_stage, -- NULL for regular season
  scheduled_date DATE,
  deadline_date DATE,
  status match_status NOT NULL DEFAULT 'pending',
  team1_score_games INTEGER,
  team2_score_games INTEGER,
  team1_score_sets INTEGER,
  team2_score_sets INTEGER,
  super_tiebreak BOOLEAN DEFAULT false,
  winner_team_id UUID REFERENCES public.ladder_teams(id),
  points_awarded INTEGER DEFAULT 0,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  dispute_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ladder_invitations table for private ladders
CREATE TABLE public.ladder_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ladder_id UUID NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ladder_id, invited_user_id)
);

-- Enable RLS on all ladder tables
ALTER TABLE public.ladders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ladder_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ladder_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ladder_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for ladders
CREATE POLICY "Users can view ladders in their HOA" 
  ON public.ladders FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.hoa_id = ladders.hoa_id
    )
  );

CREATE POLICY "Admins can create ladders in their HOA" 
  ON public.ladders FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.hoa_id = ladders.hoa_id
      AND profiles.hoa_role = 'admin'
    )
  );

CREATE POLICY "Ladder admins can update their ladders" 
  ON public.ladders FOR UPDATE 
  USING (admin_id = auth.uid());

-- RLS policies for ladder_teams
CREATE POLICY "Users can view teams in ladders they can see" 
  ON public.ladder_teams FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.ladders 
      WHERE ladders.id = ladder_teams.ladder_id
      AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.hoa_id = ladders.hoa_id
      )
    )
  );

CREATE POLICY "Ladder admins can manage teams" 
  ON public.ladder_teams FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.ladders 
      WHERE ladders.id = ladder_teams.ladder_id 
      AND ladders.admin_id = auth.uid()
    )
  );

-- RLS policies for ladder_matches
CREATE POLICY "Users can view matches in ladders they can see" 
  ON public.ladder_matches FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.ladders 
      WHERE ladders.id = ladder_matches.ladder_id
      AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.hoa_id = ladders.hoa_id
      )
    )
  );

CREATE POLICY "Team players can update their match scores" 
  ON public.ladder_matches FOR UPDATE 
  USING (
    auth.uid() IN (
      SELECT unnest(ARRAY[t1.player1_id, t1.player2_id, t2.player1_id, t2.player2_id])
      FROM public.ladder_teams t1, public.ladder_teams t2
      WHERE t1.id = ladder_matches.team1_id 
      AND t2.id = ladder_matches.team2_id
    )
  );

CREATE POLICY "Ladder admins can manage matches" 
  ON public.ladder_matches FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.ladders 
      WHERE ladders.id = ladder_matches.ladder_id 
      AND ladders.admin_id = auth.uid()
    )
  );

-- RLS policies for ladder_invitations
CREATE POLICY "Users can view their own invitations" 
  ON public.ladder_invitations FOR SELECT 
  USING (invited_user_id = auth.uid() OR invited_by = auth.uid());

CREATE POLICY "Ladder admins can create invitations" 
  ON public.ladder_invitations FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ladders 
      WHERE ladders.id = ladder_invitations.ladder_id 
      AND ladders.admin_id = auth.uid()
    )
  );

CREATE POLICY "Invited users can update their invitations" 
  ON public.ladder_invitations FOR UPDATE 
  USING (invited_user_id = auth.uid());

-- Add triggers for updated_at timestamps
CREATE TRIGGER ladders_updated_at
  BEFORE UPDATE ON public.ladders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER ladder_matches_updated_at
  BEFORE UPDATE ON public.ladder_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to calculate points based on score
CREATE OR REPLACE FUNCTION public.calculate_ladder_points(
  winner_games INTEGER,
  loser_games INTEGER,
  super_tiebreak BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF super_tiebreak THEN
    RETURN 250;
  END IF;
  
  CASE loser_games
    WHEN 0 THEN RETURN 600;  -- 6-0
    WHEN 1 THEN RETURN 550;  -- 6-1
    WHEN 2 THEN RETURN 500;  -- 6-2
    WHEN 3 THEN RETURN 450;  -- 6-3
    WHEN 4 THEN RETURN 400;  -- 6-4
    WHEN 5 THEN RETURN 350;  -- 7-5
    WHEN 6 THEN RETURN 300;  -- 7-6
    ELSE RETURN 0;
  END CASE;
END;
$$;

-- Function to generate round-robin matches for a ladder
CREATE OR REPLACE FUNCTION public.generate_round_robin_matches(
  ladder_id_param UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  team_record RECORD;
  team_ids UUID[];
  i INTEGER;
  j INTEGER;
  round_num INTEGER := 1;
  match_count INTEGER := 0;
  ladder_start_date DATE;
  match_date DATE;
BEGIN
  -- Get ladder start date
  SELECT start_date INTO ladder_start_date 
  FROM public.ladders 
  WHERE id = ladder_id_param;
  
  -- Get all team IDs for this ladder
  SELECT ARRAY_AGG(id ORDER BY created_at) INTO team_ids
  FROM public.ladder_teams
  WHERE ladder_id = ladder_id_param;
  
  -- Generate round-robin matches (each team plays every other team once)
  FOR i IN 1..array_length(team_ids, 1) LOOP
    FOR j IN (i+1)..array_length(team_ids, 1) LOOP
      match_date := ladder_start_date + (round_num - 1) * INTERVAL '7 days';
      
      INSERT INTO public.ladder_matches (
        ladder_id, 
        team1_id, 
        team2_id, 
        round_number,
        scheduled_date,
        deadline_date
      ) VALUES (
        ladder_id_param,
        team_ids[i],
        team_ids[j],
        round_num,
        match_date,
        match_date + INTERVAL '6 days'
      );
      
      match_count := match_count + 1;
      round_num := round_num + 1;
    END LOOP;
  END LOOP;
  
  RETURN match_count;
END;
$$;
