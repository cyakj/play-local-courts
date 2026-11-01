-- Resident announcements: real urgency + category metadata.   NOT APPLIED to hosted (TENISX REAL).
--
-- Community Pulse needs two facts the table never stored, so the app cannot (and must not) guess them from the text:
--   is_urgent  - an administrator marked this announcement urgent  -> a small coral dot next to it in the resident app
--   category   - 'general' | 'maintenance' | 'service'             -> resident-facing maintenance/service notices
--                (court resurfacing or closure, pool maintenance, amenity service interruption, scheduled maintenance).
-- These are ANNOUNCEMENTS to residents. They are unrelated to individual maintenance REPORTS (maintenance_reports), which stay in
-- the reports workflow and never appear in Community Pulse.
--
-- Additive and safe: both columns have defaults, so every existing announcement stays general / not urgent. No policy, grant or
-- other table is touched; the existing SELECT/INSERT policies cover the new columns. Re-appliable. No dependency on any other pending migration.
-- The app is tolerant of a server without these columns (it simply shows no urgency dot and no category chip).

ALTER TABLE public.hoa_announcements
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

ALTER TABLE public.hoa_announcements DROP CONSTRAINT IF EXISTS hoa_announcements_category_check;
ALTER TABLE public.hoa_announcements
  ADD CONSTRAINT hoa_announcements_category_check CHECK (category IN ('general', 'maintenance', 'service'));
