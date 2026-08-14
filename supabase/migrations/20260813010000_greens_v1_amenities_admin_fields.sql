-- Greens V1: expand amenities (courts) admin capabilities.
-- STAGED ONLY — not yet applied to the live database, matching the
-- existing convention used by the in-progress Match v2 migrations.
--
-- No new RLS policies needed: public.courts and public.amenity_rules
-- already carry `FOR ALL` admin policies driven by check_hoa_admin()
-- (see 20260109223632 and 20260307234917), which already covers
-- UPDATE for the new columns below.

ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS capacity integer,
  ADD COLUMN IF NOT EXISTS description text;

-- Supports multi-day blockout ranges in court_maintenance; when null,
-- a blockout is treated as same-day (date column only), unchanged
-- from current behavior.
ALTER TABLE public.court_maintenance
  ADD COLUMN IF NOT EXISTS end_date date;
