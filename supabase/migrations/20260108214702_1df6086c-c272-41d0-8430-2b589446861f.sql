-- Allow ladders to be created without an HOA (for coaches)
ALTER TABLE public.ladders ALTER COLUMN hoa_id DROP NOT NULL;