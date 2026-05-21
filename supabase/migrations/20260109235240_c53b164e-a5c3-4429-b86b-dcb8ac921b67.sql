-- Add new columns to ladders table for extended ladder management
ALTER TABLE public.ladders
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS max_teams integer DEFAULT 20,
ADD COLUMN IF NOT EXISTS min_age integer,
ADD COLUMN IF NOT EXISTS max_age integer,
ADD COLUMN IF NOT EXISTS enable_playoffs boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS playoff_teams_count integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS scoring_format text DEFAULT 'best_of_3',
ADD COLUMN IF NOT EXISTS points_per_win integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS points_per_set integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS tiebreaker_rule text DEFAULT 'head_to_head',
ADD COLUMN IF NOT EXISTS require_score_confirmation boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS dispute_window_hours integer DEFAULT 48;

-- Add comment for documentation
COMMENT ON COLUMN public.ladders.max_teams IS 'Maximum number of teams/players allowed in the ladder';
COMMENT ON COLUMN public.ladders.enable_playoffs IS 'Whether playoffs are enabled after round-robin';
COMMENT ON COLUMN public.ladders.playoff_teams_count IS 'Number of teams that qualify for playoffs';
COMMENT ON COLUMN public.ladders.scoring_format IS 'Match scoring format: best_of_1, best_of_3, pro_set';
COMMENT ON COLUMN public.ladders.points_per_win IS 'Points awarded for a match win';
COMMENT ON COLUMN public.ladders.points_per_set IS 'Points awarded per set won';
COMMENT ON COLUMN public.ladders.tiebreaker_rule IS 'Tiebreaker rule: head_to_head, games_won, sets_won';
COMMENT ON COLUMN public.ladders.require_score_confirmation IS 'Whether opponent must confirm submitted scores';
COMMENT ON COLUMN public.ladders.dispute_window_hours IS 'Hours allowed for score dispute after submission';