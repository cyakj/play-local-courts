-- Add registration_deadline column to ladders table
ALTER TABLE public.ladders 
ADD COLUMN IF NOT EXISTS registration_deadline date;