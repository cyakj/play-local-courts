-- Add location_mode to coach_availability so coaches can specify where each slot is offered.
-- Column was previously added without a DEFAULT; this migration sets the default and backfills nulls.
-- The CHECK constraint was already applied; ADD COLUMN IF NOT EXISTS is idempotent.
ALTER TABLE public.coach_availability
  ADD COLUMN IF NOT EXISTS location_mode TEXT DEFAULT 'coach_facility'
    CHECK (location_mode IN ('coach_facility', 'traveling', 'both'));

-- Ensure the column default is set (in case the column pre-existed without one)
ALTER TABLE public.coach_availability
  ALTER COLUMN location_mode SET DEFAULT 'coach_facility';

-- Backfill any rows that have a null location_mode
UPDATE public.coach_availability
  SET location_mode = 'coach_facility'
  WHERE location_mode IS NULL;
