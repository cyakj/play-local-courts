-- Add city and hoa_only columns to ladders table
ALTER TABLE public.ladders ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.ladders ADD COLUMN IF NOT EXISTS hoa_only BOOLEAN DEFAULT false;
ALTER TABLE public.ladders ADD COLUMN IF NOT EXISTS playoff_format TEXT DEFAULT 'leapfrog';

-- Add comments for clarity
COMMENT ON COLUMN public.ladders.city IS 'City/location where the ladder takes place';
COMMENT ON COLUMN public.ladders.hoa_only IS 'When true, ladder is only visible to members of the HOA';
COMMENT ON COLUMN public.ladders.playoff_format IS 'Format for playoffs: leapfrog or round_robin';