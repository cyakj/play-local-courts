-- Safe non-destructive: add structured location fields (from Mapbox geocoding)
-- to profiles. `location`, `latitude`, `longitude` already exist and are reused
-- as display_name/lat/lng. All new columns nullable so existing rows are
-- unaffected. No RLS changes — row-level policies already gate all columns.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city             TEXT,
  ADD COLUMN IF NOT EXISTS state_region     TEXT,
  ADD COLUMN IF NOT EXISTS country          TEXT,
  ADD COLUMN IF NOT EXISTS mapbox_place_id  TEXT;
