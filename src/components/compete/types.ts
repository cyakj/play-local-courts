export interface Competition {
  id: string;
  name: string;
  description: string | null;
  format: 'singles' | 'doubles' | 'mixed_doubles';
  status: 'setup' | 'active' | 'completed';
  is_private: boolean;
  hoa_id: string | null;
  admin_id: string;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  weekly_deadline_day: number | null;
  min_ntrp: number | null;
  max_ntrp: number | null;
  min_age: number | null;
  max_age: number | null;
  gender_restriction: string | null;
  max_teams: number | null;
  auto_approve_registration: boolean | null;
  enable_playoffs: boolean | null;
  playoff_teams_count: number | null;
  scoring_mode: string | null;
  scoring_format: string | null;
  third_set_format: string | null;
  points_per_win: number | null;
  points_per_set: number | null;
  participation_points: number | null;
  loss_points: number | null;
  tiebreaker_rule: string | null;
  secondary_tiebreaker: string | null;
  challenge_range: number | null;
  acceptance_window_hours: number | null;
  defense_period_days: number | null;
  play_by_deadline_days: number | null;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  require_score_confirmation: boolean | null;
  dispute_window_hours: number | null;
  city: string | null;
  hoa_only: boolean | null;
  playoff_format: string | null;
}

// Re-export as Ladder for backward compatibility
export type Ladder = Competition;

export interface CompetitionTeam {
  id: string;
  ladder_id: string;
  team_name: string;
  player1_id: string;
  player2_id: string | null;
  total_points: number;
  wins: number;
  losses: number;
  games_played: number;
  created_at: string;
}

export interface CompetitionMatch {
  id: string;
  ladder_id: string;
  team1_id: string;
  team2_id: string;
  round_number: number | null;
  playoff_stage: string | null;
  scheduled_date: string | null;
  deadline_date: string | null;
  status: 'pending' | 'submitted' | 'confirmed' | 'disputed';
  team1_score_games: number | null;
  team2_score_games: number | null;
  team1_score_sets: number | null;
  team2_score_sets: number | null;
  super_tiebreak: boolean | null;
  winner_team_id: string | null;
  points_awarded: number | null;
  submitted_by: string | null;
  submitted_at: string | null;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type CompetitionFormat = 'ladder' | 'round_robin';

export interface WizardFormData {
  // Step 1 - Format
  competitionType: CompetitionFormat | '';
  
  // Step 2 - Basic Info
  name: string;
  description: string;
  imageFile: File | null;
  imagePreview: string | null;
  city: string;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  visibility: 'community' | 'public' | 'private';
  
  // Step 3 - Eligibility
  format: 'singles' | 'doubles' | 'mixed_doubles';
  gender_restriction: string;
  min_ntrp: string;
  max_ntrp: string;
  min_age: string;
  max_age: string;
  hoa_only: boolean;
  max_teams: string;
  auto_approve_registration: boolean;
  
  // Step 4 - Structure (Ladder)
  weekly_deadline_day: number;
  challenge_range: string;
  enable_playoffs: boolean;
  playoff_teams_count: string;
  
  // Step 5 - Scoring
  scoring_mode: string;
  scoring_format: string;
  third_set_format: string;
  points_per_win: string;
  points_per_set: string;
  loss_points: string;
  tiebreaker_rule: string;
  secondary_tiebreaker: string;
  tertiary_tiebreaker: string;
  
  // Step 6 - Rules
  acceptance_window_hours: string;
  play_by_deadline_days: string;
  require_score_confirmation: boolean;
  dispute_window_hours: string;
  no_show_policy: string;
  additional_rules: string;
}
