
-- Add NTRP rating columns to the ladders table
ALTER TABLE public.ladders 
ADD COLUMN min_ntrp DECIMAL(2,1) NULL,
ADD COLUMN max_ntrp DECIMAL(2,1) NULL;

-- Add check constraints to ensure valid NTRP ratings (1.0 to 7.0)
ALTER TABLE public.ladders 
ADD CONSTRAINT check_min_ntrp_range CHECK (min_ntrp >= 1.0 AND min_ntrp <= 7.0),
ADD CONSTRAINT check_max_ntrp_range CHECK (max_ntrp >= 1.0 AND max_ntrp <= 7.0),
ADD CONSTRAINT check_ntrp_order CHECK (min_ntrp <= max_ntrp);
