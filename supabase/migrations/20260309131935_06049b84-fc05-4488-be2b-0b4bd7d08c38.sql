-- Add report_type and location_text columns
ALTER TABLE public.maintenance_reports 
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'amenity',
  ADD COLUMN IF NOT EXISTS location_text text;

-- Make amenity_id nullable
ALTER TABLE public.maintenance_reports 
  ALTER COLUMN amenity_id DROP NOT NULL;