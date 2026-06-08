-- Add lesson_types_offered and default_location_mode to coaches
ALTER TABLE coaches
  ADD COLUMN IF NOT EXISTS lesson_types_offered TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_location_mode TEXT DEFAULT 'coach_facility';

-- Enforce uniqueness on coach_availability slots (band-aligned grid relies on this)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_availability_unique_slot'
      AND conrelid = 'coach_availability'::regclass
  ) THEN
    ALTER TABLE coach_availability
      ADD CONSTRAINT coach_availability_unique_slot
      UNIQUE (coach_id, day_of_week, start_time);
  END IF;
END$$;
