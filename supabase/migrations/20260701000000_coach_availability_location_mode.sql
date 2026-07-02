-- Add location_mode to coach_availability so coaches can specify where each slot is offered.
-- Uses IF NOT EXISTS so the migration is idempotent if the column was added manually before.
ALTER TABLE public.coach_availability
  ADD COLUMN IF NOT EXISTS location_mode TEXT DEFAULT 'coach_facility'
    CHECK (location_mode IN ('coach_facility', 'traveling', 'both'));
