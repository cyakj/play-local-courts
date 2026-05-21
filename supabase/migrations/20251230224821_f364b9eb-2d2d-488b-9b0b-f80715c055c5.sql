-- Add is_hidden column to client_notes for coaches to hide clients from their list
ALTER TABLE public.client_notes ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Create index for faster queries on hidden status
CREATE INDEX IF NOT EXISTS idx_client_notes_hidden ON public.client_notes(coach_id, is_hidden);