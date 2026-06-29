-- External (non-HOA) tennis facility directory.
-- Used by the "Other Locations" tab in match creation.
-- Completely separate from the HOA courts table — no schema changes to courts.

CREATE TABLE public.tennis_facilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  city          TEXT NOT NULL,
  address       TEXT,
  latitude      NUMERIC(9, 6),
  longitude     NUMERIC(9, 6),
  facility_type TEXT NOT NULL DEFAULT 'public'
                  CHECK (facility_type IN ('public', 'private_club', 'municipal')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tennis_facilities ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active facilities (no HOA gate)
CREATE POLICY "Authenticated users can view active tennis facilities"
ON public.tennis_facilities
FOR SELECT
TO authenticated
USING (is_active = true);

-- Seed: external tennis facilities in the Puerto Rico region
INSERT INTO public.tennis_facilities (name, city, address, facility_type)
VALUES
  ('Bayamon Tennis Center', 'Bayamón', 'Bayamón, Puerto Rico', 'public');
