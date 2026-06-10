ALTER TABLE public.open_match_listings
  ADD COLUMN IF NOT EXISTS ntrp_min numeric(2,1) NOT NULL DEFAULT 1.0
    CHECK (ntrp_min BETWEEN 1.0 AND 7.0),
  ADD COLUMN IF NOT EXISTS ntrp_max numeric(2,1) NOT NULL DEFAULT 7.0
    CHECK (ntrp_max BETWEEN 1.0 AND 7.0 AND ntrp_max >= ntrp_min);

