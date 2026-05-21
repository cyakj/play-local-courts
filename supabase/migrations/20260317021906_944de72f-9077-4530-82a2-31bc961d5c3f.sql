-- Add missing columns to hoa_surveys
ALTER TABLE public.hoa_surveys 
  ADD COLUMN IF NOT EXISTS results_visibility text NOT NULL DEFAULT 'admin_only',
  ADD COLUMN IF NOT EXISTS results_reveal text NOT NULL DEFAULT 'on_close',
  ADD COLUMN IF NOT EXISTS anonymous boolean NOT NULL DEFAULT true;

-- Add required column to hoa_survey_questions
ALTER TABLE public.hoa_survey_questions
  ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT true;