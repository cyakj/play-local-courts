
ALTER TABLE public.amenity_rules
  ADD COLUMN IF NOT EXISTS singles_duration_minutes integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS doubles_duration_minutes integer DEFAULT 90,
  ADD COLUMN IF NOT EXISTS family_duration_minutes integer DEFAULT 120,
  ADD COLUMN IF NOT EXISTS group_duration_minutes integer DEFAULT 120,
  ADD COLUMN IF NOT EXISTS peak_singles_duration_minutes integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS peak_doubles_duration_minutes integer DEFAULT 45,
  ADD COLUMN IF NOT EXISTS peak_family_duration_minutes integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS peak_group_duration_minutes integer DEFAULT 60;
