-- Add ZIP code and location privacy settings to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS location_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_exact_distance BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.zip_code IS 'Primary ZIP code for location-based searches';
COMMENT ON COLUMN public.profiles.location_visible IS 'Whether the user is discoverable in location-based searches';
COMMENT ON COLUMN public.profiles.show_exact_distance IS 'If false, shows "Nearby" instead of exact distance';